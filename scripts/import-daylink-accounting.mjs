#!/usr/bin/env node
/**
 * Accounting cut-over: Daylink's Mongo books → the Daylink Tech Labs
 * tenant in Dailybiz.
 *
 *   node scripts/import-daylink-accounting.mjs          # dry run
 *   node scripts/import-daylink-accounting.mjs --live   # wipe + import
 *
 * WIPES first (live only): the tenant's journal entries + lines and GST
 * ledger rows — all POS-test junk. The 17 SYSTEM chart accounts are
 * deliberately KEPT: they are the role catalogue (`sub_category`) the
 * posting engine resolves CASH/BANK/SALES_REVENUE/… against, and every
 * future automatic posting breaks without them.
 *
 * IMPORTS the Tally-style structure as it is:
 *   11 ledger groups  → parent accounts (G-01…), grouping preserved
 *   51 ledgers        → child accounts under their group, original
 *                       L-#### codes, type/nature carried over
 *   148 vouchers      → journal entries + lines, one REST insert per
 *                       voucher so the DEFERRED balance trigger sees a
 *                       balanced set inside a single transaction
 *
 * IDEMPOTENT: accounts by (workspace, account_code); vouchers by the
 * partial unique index on (workspace, reference_type, reference_id) —
 * reference_type 'MANUAL_JOURNAL' (the reference_type CHECK is a closed
 * list; imports count as manual journals), reference_id = the Mongo _id.
 * A re-run inserts only what is missing and never duplicates a voucher.
 *
 * ledger_group is left NULL: its CHECK is a small fixed enum that lacks
 * FIXED_ASSETS / SHARE_CAPITAL / etc., and NULL passes. The REAL group
 * structure lives in parent_account_id → the G-## group accounts, which
 * carry the original names. Bank ledgers get 'BANK_ACCOUNTS', the one
 * enum value that genuinely matches.
 */

import fs from 'fs';
import { MongoClient } from 'mongodb';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CRM_DIR = path.resolve(__dirname, '..');
// Config comes from the environment; the sibling daylink checkout this
// originally read from no longer exists.
//   MONGO_URL=mongodb://…  node scripts/import-daylink-accounting.mjs --live

const LIVE = process.argv.includes('--live');
const W = 'ab6095d0-aa86-4328-934b-d56f26d8d7d8'; // Daylink Tech Labs Private Limited

const mongoUri = process.env.MONGO_URL;
if (!mongoUri) { console.error('Set MONGO_URL.'); process.exit(1); }
const crmEnv = fs.existsSync(path.join(CRM_DIR, '.env.local'))
  ? fs.readFileSync(path.join(CRM_DIR, '.env.local'), 'utf8')
  : '';
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
  || crmEnv.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || crmEnv.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
if (!SUPA || !KEY || SUPA.includes('placeholder')) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (env or .env.local).');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function sb(pathAndQuery, init = {}) {
  const res = await fetch(`${SUPA}/rest/v1/${pathAndQuery}`, { headers: H, ...init, ...(init.headers ? { headers: { ...H, ...init.headers } } : {}) });
  if (init.method === 'DELETE') return { status: res.status };
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pathAndQuery}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

const stats = {};
const bump = (k, n = 1) => (stats[k] = (stats[k] ?? 0) + n);

async function main() {
  console.log(LIVE ? '=== LIVE RUN ===' : '=== DRY RUN ===');
  const mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 15000 });
  await mongoClient.connect();
  const db = mongoClient.db();

  const groups = await db.collection('ledgergroups').find({}).toArray();
  const ledgers = await db.collection('ledgers').find({}).toArray();
  const txns = await db.collection('transactions').find({}).sort({ date: 1 }).toArray();
  console.log(`source: ${groups.length} groups, ${ledgers.length} ledgers, ${txns.length} vouchers`);

  // Sanity before touching anything: every voucher balanced.
  for (const t of txns) {
    const d = t.entries.filter((e) => e.type === 'debit').reduce((s, e) => s + e.amount, 0);
    const c = t.entries.filter((e) => e.type === 'credit').reduce((s, e) => s + e.amount, 0);
    if (Math.abs(d - c) > 0.005) throw new Error(`Unbalanced voucher ${t.voucherNo}: D${d} C${c}`);
  }

  // ---------- 1. wipe (journal + GST test data only) ----------
  const oldEntries = await sb(`commerce_journal_entries?select=id&workspace_id=eq.${W}`);
  const oldGst = await sb(`commerce_gst_ledgers?select=id&workspace_id=eq.${W}`);
  console.log(`wipe scope: ${oldEntries.length} journal entries (+lines), ${oldGst.length} GST rows — system chart accounts are KEPT`);
  if (LIVE && oldEntries.length) {
    // Lines first (FK), then entries. The deferred balance trigger allows
    // full-entry deletes: both sides vanish in the same transaction.
    for (const e of oldEntries) {
      await sb(`commerce_journal_lines?journal_entry_id=eq.${e.id}`, { method: 'DELETE' });
    }
    await sb(`commerce_journal_entries?workspace_id=eq.${W}`, { method: 'DELETE' });
    bump('wiped_entries', oldEntries.length);
  }
  if (LIVE && oldGst.length) {
    await sb(`commerce_gst_ledgers?workspace_id=eq.${W}`, { method: 'DELETE' });
    bump('wiped_gst_rows', oldGst.length);
  }

  // ---------- 2. groups → parent accounts ----------
  const existing = await sb(`commerce_chart_of_accounts?select=id,account_code&workspace_id=eq.${W}`);
  const byCode = Object.fromEntries(existing.map((a) => [a.account_code, a.id]));

  async function ensureAccount(row) {
    if (byCode[row.account_code]) {
      bump('accounts_existing');
      return byCode[row.account_code];
    }
    const id = crypto.randomUUID();
    if (LIVE) {
      await sb('commerce_chart_of_accounts', {
        method: 'POST',
        body: JSON.stringify([{ id, workspace_id: W, ...row }]),
      });
    }
    byCode[row.account_code] = id;
    bump('accounts_created');
    return id;
  }

  const groupAccountByMongo = {};
  let g = 0;
  for (const grp of groups) {
    g += 1;
    const id = await ensureAccount({
      account_code: `G-${String(g).padStart(2, '0')}`,
      account_name: grp.displayName,
      account_type: grp.groupType.toUpperCase(),
      nature: grp.groupType.toUpperCase(),
      ledger_group: null,
      is_system: false,
      opening_balance: 0,
    });
    groupAccountByMongo[String(grp._id)] = { id, systemName: grp.systemName };
  }

  // ---------- 3. ledgers → accounts under their group ----------
  const accountByLedger = {};
  for (const led of ledgers) {
    const grp = groupAccountByMongo[String(led.ledgerGroupId)];
    const id = await ensureAccount({
      account_code: led.code, // original L-#### codes, as they were
      account_name: led.displayName,
      account_type: led.ledgerType.toUpperCase(),
      nature: led.ledgerType.toUpperCase(),
      ledger_group: led.isBankAccount ? 'BANK_ACCOUNTS' : null,
      parent_account_id: grp?.id ?? null,
      is_system: false,
      opening_balance: led.openingBalance ?? 0,
    });
    accountByLedger[String(led._id)] = id;
  }

  // ---------- 4. vouchers → entries + balanced lines ----------
  const already = await sb(
    `commerce_journal_entries?select=reference_id&workspace_id=eq.${W}&reference_type=eq.MANUAL_JOURNAL&limit=1000`,
  );
  const imported = new Set(already.map((e) => e.reference_id));

  let sumDebit = 0;
  for (const t of txns) {
    if (imported.has(String(t._id))) {
      bump('vouchers_existing');
      continue;
    }
    const entryId = crypto.randomUUID();
    const lines = t.entries.map((e) => {
      const accountId = accountByLedger[String(e.ledgerId)];
      if (!accountId) throw new Error(`Voucher ${t.voucherNo}: unknown ledger ${e.ledgerId}`);
      if (e.type === 'debit') sumDebit += e.amount;
      return {
        id: crypto.randomUUID(),
        journal_entry_id: entryId,
        account_id: accountId,
        debit_amount: e.type === 'debit' ? e.amount : 0,
        credit_amount: e.type === 'credit' ? e.amount : 0,
      };
    });

    if (LIVE) {
      await sb('commerce_journal_entries', {
        method: 'POST',
        body: JSON.stringify([
          {
            id: entryId,
            workspace_id: W,
            voucher_number: t.voucherNo,
            voucher_type: 'JOURNAL',
            voucher_date: new Date(t.date).toISOString().slice(0, 10),
            narration: `${t.description} [${t.originBranch}]`,
            reference_type: 'MANUAL_JOURNAL',
            reference_id: String(t._id),
          },
        ]),
      });
      // All lines in ONE request = one transaction = the deferred
      // balance trigger sees the voucher whole.
      await sb('commerce_journal_lines', { method: 'POST', body: JSON.stringify(lines) });
    }
    bump('vouchers_created');
    bump('lines_created', lines.length);
  }

  await mongoClient.close();

  // ---------- 5. verify ----------
  if (LIVE) {
    const allEntries = await sb(
      `commerce_journal_entries?select=id&workspace_id=eq.${W}&reference_type=eq.MANUAL_JOURNAL&limit=1000`,
    );
    let d = 0;
    let c = 0;
    for (const e of allEntries) {
      const ls = await sb(`commerce_journal_lines?select=debit_amount,credit_amount&journal_entry_id=eq.${e.id}`);
      for (const l of ls) {
        d += Number(l.debit_amount) || 0;
        c += Number(l.credit_amount) || 0;
      }
    }
    console.log(`\nVERIFY: ${allEntries.length} imported vouchers | debits ₹${d.toFixed(2)} | credits ₹${c.toFixed(2)} | balanced: ${Math.abs(d - c) < 0.01}`);
    console.log(`        Mongo says both sides should be ₹4,566,019.07`);
  }

  console.log('\n=== SUMMARY ===');
  for (const [k, v] of Object.entries(stats).sort()) console.log(String(v).padStart(6), k);
  if (!LIVE) console.log('\nDry run — nothing written. Re-run with --live.');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
