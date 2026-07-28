import { describe, expect, it } from 'vitest'
import { buildParsedInbound, extractInteractiveReplyId } from './parse-inbound'

describe('buildParsedInbound', () => {
  it('maps a button_reply to kind interactive_reply with the reply_id', () => {
    const parsed = buildParsedInbound(
      {
        id: 'wamid.1',
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'btn_yes', title: 'Yes please' },
        },
      },
      'Yes please',
    )
    expect(parsed).toEqual({
      kind: 'interactive_reply',
      reply_id: 'btn_yes',
      reply_title: 'Yes please',
      meta_message_id: 'wamid.1',
    })
  })

  it('maps a list_reply to kind interactive_reply with the reply_id', () => {
    const parsed = buildParsedInbound(
      {
        id: 'wamid.2',
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: { id: 'row_pricing', title: 'Pricing', description: 'Plans' },
        },
      },
      'Pricing',
    )
    expect(parsed).toEqual({
      kind: 'interactive_reply',
      reply_id: 'row_pricing',
      reply_title: 'Pricing',
      meta_message_id: 'wamid.2',
    })
  })

  it('falls back to the reply_id when the tapped option has no title', () => {
    const parsed = buildParsedInbound(
      {
        id: 'wamid.3',
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'btn_x', title: '' },
        },
      },
      null,
    )
    expect(parsed).toMatchObject({ kind: 'interactive_reply', reply_title: 'btn_x' })
  })

  it('falls back to kind text for a malformed interactive payload', () => {
    const parsed = buildParsedInbound(
      { id: 'wamid.4', type: 'interactive', interactive: {} },
      '[Interactive reply]',
    )
    expect(parsed).toEqual({
      kind: 'text',
      text: '[Interactive reply]',
      meta_message_id: 'wamid.4',
    })
  })

  it('passes plain text through with the parsed contentText preferred', () => {
    const parsed = buildParsedInbound(
      { id: 'wamid.5', type: 'text', text: { body: 'raw body' } },
      'parsed caption',
    )
    expect(parsed).toEqual({
      kind: 'text',
      text: 'parsed caption',
      meta_message_id: 'wamid.5',
    })
  })

  it('uses the raw text body when contentText is null', () => {
    const parsed = buildParsedInbound(
      { id: 'wamid.6', type: 'text', text: { body: 'hello' } },
      null,
    )
    expect(parsed).toEqual({ kind: 'text', text: 'hello', meta_message_id: 'wamid.6' })
  })

  it('produces empty text (not a crash) for media messages without caption', () => {
    const parsed = buildParsedInbound({ id: 'wamid.7', type: 'audio' }, null)
    expect(parsed).toEqual({ kind: 'text', text: '', meta_message_id: 'wamid.7' })
  })
})

describe('extractInteractiveReplyId', () => {
  it('returns the button reply id', () => {
    expect(
      extractInteractiveReplyId({
        id: 'wamid.1',
        type: 'interactive',
        interactive: { button_reply: { id: 'btn_yes', title: 'Yes' } },
      }),
    ).toBe('btn_yes')
  })

  it('returns the list reply id', () => {
    expect(
      extractInteractiveReplyId({
        id: 'wamid.2',
        type: 'interactive',
        interactive: { list_reply: { id: 'row_1', title: 'One' } },
      }),
    ).toBe('row_1')
  })

  it('returns null for non-interactive messages', () => {
    expect(
      extractInteractiveReplyId({ id: 'wamid.3', type: 'text', text: { body: 'hi' } }),
    ).toBeNull()
  })

  it('returns null for malformed interactive payloads', () => {
    expect(
      extractInteractiveReplyId({ id: 'wamid.4', type: 'interactive', interactive: {} }),
    ).toBeNull()
  })
})
