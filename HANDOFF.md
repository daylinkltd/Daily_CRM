# Dailybuz — context brief

**Point a new session at this file.** It carries the decisions, traps and
open work that are not recoverable from the code or the git log. Read it,
then start from **§9 Open work**. Don't re-litigate anything in §2 or §5 —
those were settled the hard way.

Last verified: **2026-09-02** on the tree at the commit that added this
file — 746 tests passing, `next build` clean. Re-run the gates yourself
before trusting that: several sessions push to `main` concurrently, and
29 commits landed from another one while this brief was being written.

---

## 1. What this is

**Dailybuz** — a multi-tenant WhatsApp CRM + ERP SaaS for Indian SMBs.
One workspace runs a whole business: customers, invoicing, GST, staff,
stock, projects.

- Repo `github.com/daylinkltd/Daily_CRM`, branch `main`, auto-deploys via
  **Coolify** on push.
- Live at **https://dailybuz.com**. Older domains (`dailycrm.cloud`,
  `dailybiz.in`) appear in history — a Dailybiz rename was tried and
  fully reverted. **Brand is Dailybuz.** Internal identifiers were
  deliberately left alone; don't "fix" them.
- Local path: `~/Documents/projects/Daily_CRM`.

**Stack**: Next.js **16.2.6** (App Router), React 19.2.4, Supabase
(Postgres + RLS), Tailwind v4 design tokens, vitest, sonner.

---

## 2. Hard rules — do not deviate

**1. Never run DDL from code.** Migrations are written to
`supabase/migrations/` and **the user pastes them into the Supabase SQL
editor**. Every migration ends with a commented `Verify` block. This is
not a preference; the app has no migration runner.

**2. Run the preflight before believing anything about the database.**
`supabase/migrations/000_preflight_check.sql` — one statement, writes
nothing, lists every expected object as present/MISSING with what breaks
without it. Hand-pasted migrations leave no record, and several features
**fail silently** when their objects are absent. Memory has been wrong
about this before.

> The preflight only reports what somebody added to its list. A green
> board says nothing about a migration written after it. **When you write
> a migration, add its checks to the preflight in the same commit.**

**3. The gates are `npm ci` and `npx next build`.** Not `npm install`
(the lockfile has caught a missing dependency), and not `tsc --noEmit`
(`next build` type-checks differently and has caught errors `tsc` passed).
Run vitest too. Lint repo-wide has ~1290 pre-existing problems — check only
that *your* files add none, with `npx eslint <paths>`.

**4. Pushing needs a different GitHub account.**
```bash
gh auth switch --user swaraj792725 && git push origin main; gh auth switch --user swarajseamless
```
The default account (`swarajseamless`) gets 403 on this repo. Always
switch back.

**5. Other sessions commit to `main` concurrently.** `git fetch` and
rebase before pushing; prefer staging your own paths.

---

## 3. Verified database state

Applied: **100–124** (confirmed by preflight 2026-09-02).
Pending: **125** (`supabase/migrations/125_workspace_module_selection.sql`) — until it runs,
the onboarding module picker saves nothing, silently.

Single-device sign-in and email 2FA are now genuinely live. Before 100 was
applied, `register_session` errored on every call and the guard treated that
as "unknown" and let requests through — enforcement had been failing open
for months without a symptom.

---

## 4. Architecture you cannot guess from the code

**`src/proxy.ts` is the middleware.** Next 16 renamed it. Do not delete it
as unreferenced.

**Module access resolves through three independent authorities**, narrowest
wins, in this order:
1. **Role** (`workspace_roles.permissions` → `deriveModuleAccess`) — who on
   the team may see a module. Owner/admin bypass to everything.
2. **Platform flags** (`saas_workspace_feature_flags` → `applyPlatformFlags`)
   — our kill switch over a tenant. Does *not* honour the owner bypass.
3. **Workspace selection** (`workspaces.enabled_modules` →
   `applyWorkspaceModules`) — which of those this business actually uses,
   chosen at onboarding. Also does not bypass for owners; they turn it back
   on in Settings → Modules, where they turned it off.

**A seat is a PERSON, not a membership.** A tenant is every workspace one
user owns (`tenant_workspace_ids`). One human in three of them is one seat.
`tenant_seat_usage` / `tenant_seat_limit` are the authority and are the same
functions the insert trigger enforces with — **never recompute seats in the
UI**, that bug has been fixed once already.

**Licences** (`tenant_user_licenses`, migration 124) separate "works here"
from "is paid for". Three rules, all deliberate:
- **absence of a row means licensed** — so shipping it locked nobody out,
  and a bug costs money rather than access;
- **the owner always passes**, whatever the table says;
- **sign-in is blocked only when licensed NOWHERE** — people work for two
  tenants.

**RBAC** is a CRUD matrix (39 resources × 4 actions) plus legacy coarse keys
derived in `src/lib/auth/legacy-permissions.ts`. `has_resource_permission`
gives owner/admin a **blanket DB bypass**, so restricting an admin must be
enforced in the API route — RLS alone will not do it.

**Session verdicts** from `register_session`: `active`, `revoked`,
`needs_2fa`, `unlicensed`, `unknown`. **Every unrecognised verdict and every
error must fail OPEN.** The app and database deploy separately; a database
that knows a new verdict will hand it to an app that does not, and failing
closed there logs out every user at once.

**Platform email is Microsoft Graph only.** SMTP is impossible: the
daylink.in tenant returns `535 5.7.139 SmtpClientAuthentication is disabled
for the Tenant`, and the mailboxes are unlicensed shared mailboxes whose
sign-in is disabled by design. Never suggest SMTP settings here.

**Platform mail and tenant mail must stay separate**, and
`src/lib/platform/separation.test.ts` fails the build if they blur: platform
mail may not read `workspace_integrations`, tenant Outlook may not read
`platform_settings`, no reset path may use Supabase's mailer, and no host
may be hardcoded.

---

## 5. Traps that have already cost time

| Trap | Lesson |
|---|---|
| Print captured the whole page; then the letterhead vanished | **A letterhead is a `<header>`.** Chrome-hiding print CSS must scope to `:not(.print-area *)`. |
| Dropdowns showed the placeholder until opened | Base UI mounts items lazily, so effect-registered labels don't exist on first paint. Labels are read off the JSX tree synchronously (`collectItemLabels`). |
| GST ledger defaulted to state `'27'` and HSN `'7113'` | Defaults that are *plausible* don't fail — they **file wrong**, on someone else's GSTIN. Unset must read as unset. |
| `generate_next_document_number` ignored its own `reset_rule` | A column nothing reads is a lie. Invoice numbers must reset per financial year (Rule 46). |
| Migration 119 renamed "Agent" → "Team Member" but the function creating new workspaces still seeded "Agent" | Renaming rows is half a rename. Find the code that makes new ones. |
| A picker lost the first of two answers made in one tick | Handlers read `value` from props — a render snapshot. Use functional updates (`onChange(prev => …)`). Tests passed; only clicking it found this. |
| HTML body sent as `contentType: 'Text'` (Graph) after the same bug was fixed for SMTP | Graph and SMTP are separate code paths. Fixing one does not reach the other. |
| `next build` failed on a type error `tsc --noEmit` passed | See §2 rule 3. |
| Empty selection could hide every module | Hiding everything also hides the navigation that undoes it. **Empty means "not chosen" and resolves to all.** |

---

## 6. Current initiative — automated GST filing

Full plan (registration path, phases, pricing) was delivered as a PDF/artifact.
The essentials:

**Direct filing requires a GSP** — GSTN issues no API credentials to software
vendors; we would be an ASP on a licensed GSP's gateway. Sandboxes are free;
production is roughly **₹6k–25k/yr platform floor plus ₹0.10–₹1 per API call**
(~₹12 per filing). **E-invoicing (IRN) is free** via the authorised IRPs
(IRIS IRP basic tier; Cygnet IRP is free for ASPs).

**Verify before quoting any of that to a customer.** GST thresholds, scheme
limits and EVC eligibility change constantly.

**Phases** — 0 (ledger correctness) ✅ done, 0.5 (return preview + GSTN JSON
export, ₹0, independently sellable) ← next, 1 (GSP sandbox, prove CMP-08 end
to end), 2 (production filing + prepaid billing), 3 (GSTR-2B reconciliation),
4 (e-invoicing).

**Phase 0 landed** in `0f252da`: the GST ledger is now fed by invoices *and*
purchases (it was POS-only, so the INPUT/ITC side had never had a single row),
plus `supply_type` classification (`src/lib/commerce/gst/supply-classification.ts`,
tested) and the numbering fix.

**Decisions still open — ask, don't assume:**
1. **Billing model.** Cost-plus-5% per filing is ruled out by arithmetic:
   ~₹12 cost, ₹0.60 margin, and Razorpay's ~2% eats half of that — ₹3.60/year
   per shop. Recommended: **prepaid credits** (one gateway fee, cash collected
   before any API call) at a flat ~₹49/filing, or bundle into a tier.
2. **Composition or QRMP customers?** CMP-08 is the simplest return in GST and
   the right first filing; GSTR-1 is a much bigger build. This decides the order.
3. **Do we file, or does a CA approve and then we file?**
4. **Static outbound IPs** — GSTN whitelists caller IPs. Coolify needs a fixed
   egress IP before Phase 2 can reach production. This constrains hosting.

**Rejected, with reasons** (don't revisit without new information):
- *PhonePe as a filing source.* GST is charged on **supplies made**, not
  payments received — filing from receipts omits every cash sale and the
  penalty lands on the customer. There's also no API: a QR merchant has no
  credentials, and Account Aggregator requires being a regulated FIU.
  **Reframed as reconciliation** (upload a bank statement, compare deposits to
  recorded sales) — genuinely valuable, ships with Phase 3's matching engine.
- *Two invoice series to keep sales off the books.* The legitimate model is
  three documents: tax invoice, bill of supply, proforma. What sends a sale to
  the portal is **whether the supply is taxable**, not which series it carries.
  `platform_number_series` already supports independent series.

---

## 7. How to verify work here

**Database**: paste the preflight. For a specific migration, its `Verify`
block is written to be pasted as-is.

**UI**: a throwaway route under `src/app/<name>-temp/page.tsx` plus
`preview_start` is the established pattern — render the component with stubbed
props, drive it, screenshot, then **delete the route and restore
`.claude/launch.json`**. This caught the module-picker stale-closure bug that
746 passing tests did not.

**What you cannot verify**: anything needing an authenticated session. Signing
in with the user's credentials is off-limits. Say so plainly and name the check
they should run instead — don't imply you verified it.

---

## 8. Working style the user expects

- Lead with the outcome. Be explicit about **verified vs. assumed**.
- They are the technical owner and act on precise instructions ("paste this
  migration", "fix this env var").
- **Push back with the arithmetic** when a plan doesn't survive it — the
  cost-plus-5% pricing and the PhonePe idea were both corrected this way and
  the corrections were wanted.
- Don't guess at vague scope. "Fix other things in the app" got a request for
  specifics rather than a speculative sweep, and that was the right call.

---

## 9. Open work

### Ready to do
0. **Paste the marketing migrations — renumbered at merge time.** Vivian's
   branch numbered them 126–130, but printing/HR had already taken 126–128
   on main, so they are now **129–133** (same content, same order):
   `129_marketing_hub`, `130_marketing_creative_prompts`,
   `131_expand_marketing_content_types`, `132_marketing_video_and_image_assets`,
   `133_marketing_brand_profile_and_assets`. Also **re-paste 111**
   (`111_marketing_buffer_integrations.sql`) — the branch changed its RLS in
   place (idempotent DROP/CREATE) and the applied DB still has the old
   policies. Note: the new 111 deliberately loosens integration writes from
   permission-gated to any-active-member (Vivian's Buffer RLS fix).
   Preflight covers 129/130/133 — run it after pasting.
   Marketing hub itself (from the PR): structured AI content generation,
   prompt-only image/video creation (no fake media), Buffer OAuth PKCE with
   AES-256-GCM tokens, approval governance with admin precedence.
1. **Paste migration 128** (`printing_presets.sql`) — preset vocabulary for
   the printing module — DONE per user (2026-09-06), presets verified live.
   App-wide pattern that shipped with it: `CreatableSelect`
   (ui/creatable-select) and `SearchableSelect`'s `createLabel`/`onCreate` —
   searchable dropdowns with a pinned "+ Add" opening a quick-create dialog
   (`shared/quick-create-contact`, `shared/quick-create-ledger`,
   `printing/quick-create-preset`); adopted in the printing job form, the
   invoice create dialog, and both accounting entry screens. New pickers
   should follow it.
2. **Migration 127** (`printing_press_module.sql`) — DONE per user
   (2026-09-06); PJ-000001 consumed by a verification probe, PJ-000002 was
   the user's test job. Printing Press module live: tables, RLS, PJ- series,
   `invoices.source` widened to `'printing'`; accounting gained ledger
   delete + voucher void gated by the `accounting:delete` matrix key.
3. **Paste migration 125.** Nothing else in this section depends on it, but the
   module picker is inert until it runs.
4. **GST Phase 0 remnants** — all agreed, none started:
   - GSTIN field on the contact form (column exists from 123, no UI)
   - HSN on products, with the AI-assisted suggestion (model keys are in env)
   - The exception list as a screen — `ledgerExceptions()` in
     `src/lib/commerce/gst/supply-classification.ts` returns the messages, nothing renders them
5. **GST Phase 0.5** — compute GSTR-1 / GSTR-3B / CMP-08 from the ledger and
   export GSTN-schema JSON. Zero cost, no vendor, independently sellable.
6. **Verify licences and modules in the real app** — revoke a licence and
   confirm the sign-in refusal names the owner; switch a module off and confirm
   it leaves the sidebar for everyone.

### Operational, needs the user
5. **Rotate the production secrets pasted into chat** earlier in this session:
   mailbox password, MongoDB URI, NextAuth secret, R2 keys, Gemini/Groq keys,
   `DAYLINK_PAY_SECRET`.
6. **Coolify env vars** `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` still
   say `dailycrm.cloud`. They override the code, so links stay wrong until
   changed to `https://dailybuz.com`.
7. **Supabase dashboard Site URL** — the app now mints its own recovery links
   (`appRecoveryLink`) so resets work, but the dashboard setting is still
   unfixed.
8. **Mongo import never ran** — needs a real `SUPABASE_SERVICE_ROLE_KEY`. The
   script (`import-daylink-new-data.mjs`) is ready: 44 HR letters, 15 leads,
   43 internships. `mongodb` is deliberately **not** a dependency; it loads
   lazily in ETL scripts only. Do not add it to `package.json`.
9. **Daylink payment-hub repo** (not on this machine) still shows "Dailybiz".

### Inherited from an earlier session — carried forward, NOT re-verified
Still present in the tree as of 2026-09-02, but their status was established
before this session:
10. **58 duplicate contact numbers** in production. Mixed causes — true
    duplicates, and legitimately shared business lines (four branches on one
    number) which must **not** be merged. Offer a read-only preview first.
11. **Flows/chatbot has no RBAC coverage** — `flows`/`flow_runs` are
    `user_id`-scoped, not `workspace_id`, so they sit outside the resource
    catalog. Closing it needs a schema change plus backfill.
12. **Unreferenced but possibly staged — ask before deleting**:
    `src/lib/contacts/dedupe.ts`, `src/lib/contacts/parse-contact-csv.ts`,
    `src/lib/hr/attendance/attendance-engine.ts`,
    `src/components/presence/presence-heartbeat.tsx`,
    `src/components/ui/radio-group.tsx`.
13. Optional: generate Supabase `Database` types to remove ~150 `any`s.
14. Optional: stop an admin ticking *write* permissions on the built-in
    "Viewer" role, which currently makes the name misleading.
