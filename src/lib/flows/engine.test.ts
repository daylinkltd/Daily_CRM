import { beforeEach, describe, expect, it, vi } from 'vitest'

// ------------------------------------------------------------
// Module mocks. The engine reaches Supabase only through
// `supabaseAdmin()` (./admin-client) and Meta only through the
// engineSend* functions (./meta-send) — mock both and the whole
// dispatch path becomes unit-testable against an in-memory DB.
// ------------------------------------------------------------

vi.mock('./admin-client', () => ({
  supabaseAdmin: () => currentDb,
}))

vi.mock('./meta-send', () => ({
  engineSendText: vi.fn(async () => ({ whatsapp_message_id: 'wamid.SENT' })),
  engineSendMedia: vi.fn(async () => ({ whatsapp_message_id: 'wamid.MEDIA' })),
  engineSendInteractiveButtons: vi.fn(async () => ({
    whatsapp_message_id: 'wamid.BTN',
  })),
  engineSendInteractiveList: vi.fn(async () => ({
    whatsapp_message_id: 'wamid.LIST',
  })),
}))

import {
  dispatchInboundToFlows,
  evaluateConditionPredicate,
  isAutoAdvancing,
  isSuspending,
  isTerminal,
  matchReplyId,
  matchesKeywordTrigger,
} from './engine'
import {
  engineSendInteractiveButtons,
  engineSendText,
} from './meta-send'

// ------------------------------------------------------------
// Tiny in-memory PostgREST stand-in. Supports exactly the chain
// surface the engine uses: select / insert / update / delete,
// eq / is / in / filter, order / limit, single / maybeSingle,
// head+count, and rpc(). Every query is recorded so tests can
// assert WHICH columns the engine filtered by (the account_id →
// user_id regression is a filter-column bug, invisible to a
// results-only assertion).
// ------------------------------------------------------------

type Row = Record<string, unknown>

interface RecordedQuery {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  filters: Array<{ type: string; col: string; val: unknown }>
  values?: Row | Row[]
}

let idCounter = 0

function createMockDb(tables: Record<string, Row[]>) {
  const queries: RecordedQuery[] = []

  function rowMatches(row: Row, filters: RecordedQuery['filters']): boolean {
    return filters.every((f) => {
      if (f.type === 'eq' || f.type === 'is') return row[f.col] === f.val
      if (f.type === 'in') return (f.val as unknown[]).includes(row[f.col])
      if (f.type === 'jsonFilter') {
        const m = /^(\w+)->>(\w+)$/.exec(f.col)
        if (!m) return false
        const outer = row[m[1]] as Record<string, unknown> | undefined
        return String(outer?.[m[2]] ?? '') === String(f.val)
      }
      return true
    })
  }

  function from(table: string) {
    const state = {
      op: 'select' as RecordedQuery['op'],
      filters: [] as RecordedQuery['filters'],
      values: undefined as Row | Row[] | undefined,
      single: false,
      returning: false,
      head: false,
      count: false,
      limit: undefined as number | undefined,
    }

    function resolve(): {
      data: unknown
      error: null
      count?: number
    } {
      const rows = tables[table] ?? (tables[table] = [])
      queries.push({
        table,
        op: state.op,
        filters: state.filters,
        values: state.values,
      })

      if (state.op === 'insert' || state.op === 'upsert') {
        const inserted = (Array.isArray(state.values)
          ? state.values
          : [state.values!]
        ).map((v) => ({ id: `gen-${++idCounter}`, ...v }))
        rows.push(...inserted)
        if (!state.returning) return { data: null, error: null }
        return {
          data: state.single ? inserted[0] : inserted,
          error: null,
        }
      }
      if (state.op === 'update') {
        const matched = rows.filter((r) => rowMatches(r, state.filters))
        for (const r of matched) Object.assign(r, state.values)
        if (!state.returning) return { data: null, error: null }
        return { data: matched, error: null }
      }
      if (state.op === 'delete') {
        const keep = rows.filter((r) => !rowMatches(r, state.filters))
        tables[table] = keep
        return { data: null, error: null }
      }
      // select
      let matched = rows.filter((r) => rowMatches(r, state.filters))
      if (state.limit !== undefined) matched = matched.slice(0, state.limit)
      if (state.head) {
        return { data: null, error: null, count: matched.length }
      }
      if (state.single) {
        return { data: matched[0] ?? null, error: null }
      }
      return { data: matched, error: null }
    }

    const builder: Record<string, unknown> = {
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        if (state.op === 'select' && opts?.head) {
          state.head = true
          state.count = true
        }
        if (state.op !== 'select') state.returning = true
        return builder
      },
      insert(values: Row | Row[]) {
        state.op = 'insert'
        state.values = values
        return builder
      },
      upsert(values: Row | Row[]) {
        state.op = 'upsert'
        state.values = values
        return builder
      },
      update(values: Row) {
        state.op = 'update'
        state.values = values
        return builder
      },
      delete() {
        state.op = 'delete'
        return builder
      },
      eq(col: string, val: unknown) {
        state.filters.push({ type: 'eq', col, val })
        return builder
      },
      is(col: string, val: unknown) {
        state.filters.push({ type: 'is', col, val })
        return builder
      },
      in(col: string, val: unknown[]) {
        state.filters.push({ type: 'in', col, val })
        return builder
      },
      filter(col: string, _op: string, val: unknown) {
        state.filters.push({ type: 'jsonFilter', col, val })
        return builder
      },
      order() {
        return builder
      },
      limit(n: number) {
        state.limit = n
        return builder
      },
      maybeSingle() {
        state.single = true
        return builder
      },
      single() {
        state.single = true
        return builder
      },
      then(
        onFulfilled: (v: ReturnType<typeof resolve>) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) {
        return Promise.resolve(resolve()).then(onFulfilled, onRejected)
      },
    }
    return builder
  }

  return {
    from,
    rpc: vi.fn(async () => ({ error: null })),
    queries,
    tables,
  }
}

let currentDb: ReturnType<typeof createMockDb>

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

const USER = 'user-1'
const CONTACT = 'contact-1'
const CONVERSATION = 'conv-1'

function keywordFlow(overrides: Row = {}): Row {
  return {
    id: 'flow-1',
    user_id: USER,
    name: 'Welcome bot',
    status: 'active',
    trigger_type: 'keyword',
    trigger_config: { keywords: ['hi'] },
    entry_node_id: 'start',
    fallback_policy: {
      on_unknown_reply: 'reprompt',
      max_reprompts: 2,
      on_timeout_hours: 24,
      on_exhaust: 'handoff',
    },
    execution_count: 0,
    ...overrides,
  }
}

function nodesForButtonsFlow(): Row[] {
  return [
    {
      id: 'n-start',
      flow_id: 'flow-1',
      node_key: 'start',
      node_type: 'start',
      config: { next_node_key: 'ask' },
    },
    {
      id: 'n-ask',
      flow_id: 'flow-1',
      node_key: 'ask',
      node_type: 'send_buttons',
      config: {
        text: 'Interested?',
        buttons: [
          { reply_id: 'btn_yes', title: 'Yes', next_node_key: 'thanks' },
          { reply_id: 'btn_no', title: 'No', next_node_key: 'bye' },
        ],
      },
    },
    {
      id: 'n-thanks',
      flow_id: 'flow-1',
      node_key: 'thanks',
      node_type: 'send_message',
      config: { text: 'Great!', next_node_key: 'bye' },
    },
    {
      id: 'n-bye',
      flow_id: 'flow-1',
      node_key: 'bye',
      node_type: 'end',
      config: {},
    },
  ]
}

function activeRunAtAsk(): Row {
  return {
    id: 'run-1',
    flow_id: 'flow-1',
    user_id: USER,
    contact_id: CONTACT,
    conversation_id: CONVERSATION,
    status: 'active',
    current_node_key: 'ask',
    last_prompt_message_id: null,
    vars: {},
    reprompt_count: 0,
    started_at: '2026-01-01T00:00:00Z',
    last_advanced_at: '2026-01-01T00:00:00Z',
    ended_at: null,
    end_reason: null,
  }
}

beforeEach(() => {
  currentDb = createMockDb({
    flows: [],
    flow_nodes: [],
    flow_runs: [],
    flow_run_events: [],
    messages: [],
    conversations: [],
    contact_tags: [],
    contacts: [],
  })
})

// ------------------------------------------------------------
// Pure helpers
// ------------------------------------------------------------

describe('matchReplyId', () => {
  const buttonsNode = {
    node_type: 'send_buttons',
    config: {
      buttons: [
        { reply_id: 'a', title: 'A', next_node_key: 'node_a' },
        { reply_id: 'b', title: 'B', next_node_key: 'node_b' },
      ],
    } as Record<string, unknown>,
  }

  it('matches a button reply_id to its next_node_key', () => {
    expect(matchReplyId(buttonsNode, 'b')).toBe('node_b')
  })

  it('returns null for an unknown reply_id', () => {
    expect(matchReplyId(buttonsNode, 'zzz')).toBeNull()
  })

  it('matches list rows across sections', () => {
    const listNode = {
      node_type: 'send_list',
      config: {
        sections: [
          { rows: [{ reply_id: 'r1', title: 'One', next_node_key: 'n1' }] },
          { rows: [{ reply_id: 'r2', title: 'Two', next_node_key: 'n2' }] },
        ],
      } as Record<string, unknown>,
    }
    expect(matchReplyId(listNode, 'r2')).toBe('n2')
  })

  it('returns null for node types that take no interactive reply', () => {
    expect(
      matchReplyId({ node_type: 'collect_input', config: {} }, 'a'),
    ).toBeNull()
  })
})

describe('matchesKeywordTrigger', () => {
  it('contains-matches case-insensitively by default', () => {
    expect(matchesKeywordTrigger('Hi there', { keywords: ['hi'] })).toBe(true)
  })

  it('exact match rejects partial hits', () => {
    expect(
      matchesKeywordTrigger('hi there', { keywords: ['hi'], match_type: 'exact' }),
    ).toBe(false)
    expect(
      matchesKeywordTrigger('hi', { keywords: ['hi'], match_type: 'exact' }),
    ).toBe(true)
  })

  it('respects case sensitivity when configured', () => {
    expect(
      matchesKeywordTrigger('HI', { keywords: ['hi'], case_sensitive: true }),
    ).toBe(false)
  })

  it('is false for empty text or empty keyword list', () => {
    expect(matchesKeywordTrigger('', { keywords: ['hi'] })).toBe(false)
    expect(matchesKeywordTrigger('hi', { keywords: [] })).toBe(false)
  })
})

describe('evaluateConditionPredicate', () => {
  it('present / absent', () => {
    expect(
      evaluateConditionPredicate({
        operator: 'present',
        subjectValue: 'x',
        configValue: undefined,
      }),
    ).toBe(true)
    expect(
      evaluateConditionPredicate({
        operator: 'absent',
        subjectValue: undefined,
        configValue: undefined,
      }),
    ).toBe(true)
  })

  it('equals / contains', () => {
    expect(
      evaluateConditionPredicate({
        operator: 'equals',
        subjectValue: 'gold',
        configValue: 'gold',
      }),
    ).toBe(true)
    expect(
      evaluateConditionPredicate({
        operator: 'contains',
        subjectValue: 'goldfish',
        configValue: 'gold',
      }),
    ).toBe(true)
    expect(
      evaluateConditionPredicate({
        operator: 'equals',
        subjectValue: undefined,
        configValue: 'gold',
      }),
    ).toBe(false)
  })
})

describe('node-type classifiers', () => {
  it('classify the v1.5 node set consistently', () => {
    for (const t of ['start', 'send_message', 'send_media', 'condition', 'set_tag']) {
      expect(isAutoAdvancing(t)).toBe(true)
    }
    for (const t of ['send_buttons', 'send_list', 'collect_input']) {
      expect(isSuspending(t)).toBe(true)
      expect(isAutoAdvancing(t)).toBe(false)
    }
    for (const t of ['handoff', 'end']) {
      expect(isTerminal(t)).toBe(true)
    }
  })
})

// ------------------------------------------------------------
// dispatchInboundToFlows — against the in-memory DB
// ------------------------------------------------------------

describe('dispatchInboundToFlows', () => {
  it('starts a run when a text message matches a keyword trigger', async () => {
    currentDb.tables.flows.push(keywordFlow())
    currentDb.tables.flow_nodes.push(...nodesForButtonsFlow())

    const result = await dispatchInboundToFlows({
      userId: USER,
      contactId: CONTACT,
      conversationId: CONVERSATION,
      message: { kind: 'text', text: 'hi there', meta_message_id: 'wamid.1' },
      isFirstInboundMessage: false,
    })

    expect(result.consumed).toBe(true)
    // start → ask (send_buttons) suspends, so the run "advanced"
    // which startNewRun reports as "started".
    expect(result.outcome).toBe('started')

    // The run row is user_id-tenanted, matching migration 027.
    const run = currentDb.tables.flow_runs[0]
    expect(run).toMatchObject({
      flow_id: 'flow-1',
      user_id: USER,
      contact_id: CONTACT,
      conversation_id: CONVERSATION,
      status: 'active',
      current_node_key: 'ask',
    })
    expect(run).not.toHaveProperty('account_id')

    expect(engineSendInteractiveButtons).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        conversationId: CONVERSATION,
        contactId: CONTACT,
      }),
    )
    expect(currentDb.rpc).toHaveBeenCalledWith('increment_flow_execution_count', {
      p_flow_id: 'flow-1',
    })
  })

  it('filters flows and flow_runs by user_id — never account_id', async () => {
    currentDb.tables.flows.push(keywordFlow())
    currentDb.tables.flow_nodes.push(...nodesForButtonsFlow())

    await dispatchInboundToFlows({
      userId: USER,
      contactId: CONTACT,
      conversationId: CONVERSATION,
      message: { kind: 'text', text: 'hi', meta_message_id: 'wamid.2' },
      isFirstInboundMessage: false,
    })

    const flowSelects = currentDb.queries.filter(
      (q) => q.table === 'flows' && q.op === 'select',
    )
    expect(flowSelects.length).toBeGreaterThan(0)
    for (const q of flowSelects) {
      expect(q.filters).toContainEqual({ type: 'eq', col: 'user_id', val: USER })
    }

    const allFilterCols = currentDb.queries.flatMap((q) =>
      q.filters.map((f) => f.col),
    )
    expect(allFilterCols).not.toContain('account_id')
  })

  it('does not start flows for another user', async () => {
    currentDb.tables.flows.push(keywordFlow({ user_id: 'someone-else' }))
    currentDb.tables.flow_nodes.push(...nodesForButtonsFlow())

    const result = await dispatchInboundToFlows({
      userId: USER,
      contactId: CONTACT,
      conversationId: CONVERSATION,
      message: { kind: 'text', text: 'hi', meta_message_id: 'wamid.3' },
      isFirstInboundMessage: false,
    })

    expect(result).toMatchObject({ consumed: false, outcome: 'no_match' })
    expect(currentDb.tables.flow_runs).toHaveLength(0)
  })

  it('advances an active run when the tapped button matches', async () => {
    currentDb.tables.flows.push(keywordFlow())
    currentDb.tables.flow_nodes.push(...nodesForButtonsFlow())
    currentDb.tables.flow_runs.push(activeRunAtAsk())

    const result = await dispatchInboundToFlows({
      userId: USER,
      contactId: CONTACT,
      conversationId: CONVERSATION,
      message: {
        kind: 'interactive_reply',
        reply_id: 'btn_yes',
        reply_title: 'Yes',
        meta_message_id: 'wamid.4',
      },
      isFirstInboundMessage: false,
    })

    expect(result.consumed).toBe(true)
    // btn_yes → thanks (send_message) → bye (end): run completes.
    expect(result.outcome).toBe('completed')
    expect(engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER, text: 'Great!' }),
    )
    expect(currentDb.tables.flow_runs[0]).toMatchObject({
      status: 'completed',
      end_reason: 'end_node',
    })
  })

  it('interactive replies never start a new flow', async () => {
    currentDb.tables.flows.push(keywordFlow())
    currentDb.tables.flow_nodes.push(...nodesForButtonsFlow())

    const result = await dispatchInboundToFlows({
      userId: USER,
      contactId: CONTACT,
      conversationId: CONVERSATION,
      message: {
        kind: 'interactive_reply',
        reply_id: 'btn_yes',
        reply_title: 'Yes',
        meta_message_id: 'wamid.5',
      },
      isFirstInboundMessage: false,
    })

    expect(result).toMatchObject({ consumed: false, outcome: 'no_match' })
    expect(currentDb.tables.flow_runs).toHaveLength(0)
  })

  it('fires the fallback (reprompt) when the reply matches no option', async () => {
    currentDb.tables.flows.push(keywordFlow())
    currentDb.tables.flow_nodes.push(...nodesForButtonsFlow())
    currentDb.tables.flow_runs.push(activeRunAtAsk())

    const result = await dispatchInboundToFlows({
      userId: USER,
      contactId: CONTACT,
      conversationId: CONVERSATION,
      message: {
        kind: 'interactive_reply',
        reply_id: 'btn_unknown',
        reply_title: '???',
        meta_message_id: 'wamid.6',
      },
      isFirstInboundMessage: false,
    })

    expect(result).toMatchObject({ consumed: true, outcome: 'fallback_fired' })
    // The prompt was re-sent, the run stays active on the same node.
    expect(engineSendInteractiveButtons).toHaveBeenCalledTimes(1)
    expect(currentDb.tables.flow_runs[0]).toMatchObject({
      status: 'active',
      current_node_key: 'ask',
      reprompt_count: 1,
    })
  })

  it('ignores a duplicate inbound (same meta_message_id) for an active run', async () => {
    currentDb.tables.flows.push(keywordFlow())
    currentDb.tables.flow_nodes.push(...nodesForButtonsFlow())
    currentDb.tables.flow_runs.push(activeRunAtAsk())
    currentDb.tables.flow_run_events.push({
      id: 'evt-1',
      flow_run_id: 'run-1',
      event_type: 'reply_received',
      node_key: 'ask',
      payload: { meta_message_id: 'wamid.dup' },
    })

    const result = await dispatchInboundToFlows({
      userId: USER,
      contactId: CONTACT,
      conversationId: CONVERSATION,
      message: {
        kind: 'interactive_reply',
        reply_id: 'btn_yes',
        reply_title: 'Yes',
        meta_message_id: 'wamid.dup',
      },
      isFirstInboundMessage: false,
    })

    expect(result).toMatchObject({
      consumed: true,
      outcome: 'duplicate_inbound_ignored',
    })
    expect(engineSendText).not.toHaveBeenCalled()
    expect(currentDb.tables.flow_runs[0]).toMatchObject({
      status: 'active',
      current_node_key: 'ask',
    })
  })

  it('captures a text reply into vars on a collect_input node', async () => {
    currentDb.tables.flows.push(keywordFlow())
    currentDb.tables.flow_nodes.push(
      {
        id: 'n-collect',
        flow_id: 'flow-1',
        node_key: 'collect_name',
        node_type: 'collect_input',
        config: {
          prompt_text: 'Your name?',
          var_key: 'name',
          next_node_key: 'bye',
        },
      },
      {
        id: 'n-bye',
        flow_id: 'flow-1',
        node_key: 'bye',
        node_type: 'end',
        config: {},
      },
    )
    currentDb.tables.flow_runs.push({
      ...activeRunAtAsk(),
      current_node_key: 'collect_name',
    })

    const result = await dispatchInboundToFlows({
      userId: USER,
      contactId: CONTACT,
      conversationId: CONVERSATION,
      message: { kind: 'text', text: '  Ada Lovelace ', meta_message_id: 'wamid.7' },
      isFirstInboundMessage: false,
    })

    expect(result).toMatchObject({ consumed: true, outcome: 'completed' })
    expect(currentDb.tables.flow_runs[0]).toMatchObject({
      status: 'completed',
      vars: { name: 'Ada Lovelace' },
    })
  })
})
