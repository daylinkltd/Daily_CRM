# Daily CRM — session handoff brief

Paste this whole file as your first message in a new session.

---

You are picking up work on **Daily CRM** (`/Volumes/projects/Daily_CRM`), a
multi-tenant WhatsApp CRM SaaS. Read this brief, then continue from
"OPEN WORK" at the end. Don't re-litigate decisions recorded here.

## 1. Environment facts

- **Stack**: Next.js **16.2.6** (App Router; note its middleware file is
  renamed — it is `src/proxy.ts`, do NOT delete it as "unreferenced"),
  Supabase (Postgres + RLS), Tailwind v4 with CSS design tokens, Radix,
  sonner toasts, vitest.
- **Repo**: `github.com/daylinkltd/Daily_CRM`, branch `main`, auto-deploys
  to **https://dailycrm.cloud** via **Coolify** on push.
- **Read `AGENTS.md`/`CLAUDE.md` first** — the project instructs you to
  consult `node_modules/next/dist/docs/` before writing framework code,
  because this Next version differs from training data.
- `.env.local` holds working Supabase + `ENCRYPTION_KEY` + `META_APP_SECRET`.
  The local `ENCRYPTION_KEY` matches production (proven: locally-encrypted
  values decrypt in prod), so you can decrypt/encrypt DB credentials locally.
- **Other people/sessions commit to `main` concurrently.** Always
  `git fetch` + rebase before pushing, and prefer committing only your own
  files (`git add <paths>`) so you don't sweep someone's half-finished work.

## 2. Verified state at handoff

- HEAD = `701e328`. Typecheck clean, **217 tests pass**, production build
  succeeds. Lint: 576 problems repo-wide (down from 6,087 — see §5).
- WhatsApp **inbound and outbound both work in production** (confirmed with
  real Meta traffic and real `wamid` ids).

## 3. What was fixed/built this session (the short version)

**WhatsApp (the original complaint: "no inbound, outbound only reaches my
number")**
- Inbound was dead because production's `META_APP_SECRET` was **not the
  secret of Meta app `1491199826110226`**, so every signed webhook was
  rejected 401. The correct secret is now stored **encrypted in
  `whatsapp_config.app_secret`** for the workspace, which the code prefers
  over the (still wrong) env var. Fixed + proven by sending a signed
  webhook to prod and getting 200.
- "Outbound only to my number" was **not a bug**: only `hello_world` is
  APPROVED on Meta. Outside the 24-hour window a template is mandatory.
  The library at Settings → Templates → Library exists to fix that.
- WABA webhook subscription is pinned with `override_callback_uri`, so the
  Meta App dashboard can't silently break delivery.
- `/api/admin/webhook-status` now self-diagnoses app-secret validity and
  logs rejected webhooks with a reason.

**Security holes closed** (all were live): unauthenticated
`/api/verify-payment` (anyone could upgrade any workspace for ₹1),
public `/api/admin/*` leaking cross-tenant messages, path traversal in
file uploads, workspace admins able to self-promote to owner, a webhook
signature bypass, hardcoded super-admin credentials resettable from a
public page, and five tables still on per-user RLS (including one policy
that let **any** authenticated user insert into **any** conversation).

**RBAC (built this session, biggest piece)**
- `src/lib/auth/resources.ts` is **the single source of truth**: 32 feature
  resources → 120 tables. `scripts/generate-crud-rls.mjs` **generates**
  migration `074` from it, so the UI matrix and DB policies cannot drift.
  If you change permissions, edit the catalog and **regenerate**:
  `node --experimental-strip-types scripts/generate-crud-rls.mjs > supabase/migrations/074_crud_rbac.sql`
- Permissions are `<resource>:<action>` (e.g. `payroll:read`) + module keys
  (`module_crm|hr|retail|projects`) in `workspace_roles.permissions` JSONB.
  128 toggles per role. `workspace_members.role_id` points at the role.
- Enforced in Postgres via RESTRICTIVE policies per SQL operation, plus
  `has_resource_permission()`. Owners/admins bypass; `service_role`
  bypasses RLS so webhooks are unaffected.
- UI: dedicated **Roles panel** (`src/components/settings/roles-panel.tsx`
  + `permission-matrix.tsx`), built-in **Owner/Admin/Viewer**, Viewer is
  editable, Team Members picks any role.

**Other**: inbox rebuilt visually (WhatsApp-style wallpaper, bubbles),
24h-window template re-engage flow, sound + desktop notifications,
polling cost cut ~95%, public API `/api/v1/messages` send + status,
API key prefix rebranded to `dailycrm_live_` (legacy `wacrm_live_` still
accepted), currency propagation, 19 prebuilt templates, landing page +
auth pages fixed, dead code deleted.

## 4. CRITICAL — do this first

**Four migrations are NOT yet applied to production.** Everything below
stays broken until they are:

> Paste **`supabase/bundles/APPLY-PENDING.sql`** into the Supabase SQL
> editor and run it once. It bundles 071→072→073→074 in dependency order,
> is idempotent, and was validated end-to-end against a production-shaped
> Postgres in Docker.

What it fixes: emoji reactions (071), template submit + "Sync from Meta"
(072), and it switches on the whole role system (073 module keys → 074
CRUD). Applying it is **non-disruptive**: existing roles are granted
exactly what their holders can already do, and members without a role are
backfilled, so nobody loses access. You then restrict per role in the UI.

Verify afterwards by re-running the pending-migration probe in §7.

## 5. Hard-won knowledge — read before touching these areas

1. **ALWAYS validate migrations in Docker before shipping.** Three of my
   migrations were broken and caught only this way:
   - a `record`→table row cast that failed on a CTE with an extra column;
   - normalizing values **before** dropping the old CHECK constraint;
   - **the dangerous one**: RESTRICTIVE-only policies. A restrictive policy
     only subtracts; Postgres grants nothing unless a PERMISSIVE policy
     matches. Enabling RLS on a table with no permissive policy returns
     **zero rows to everyone, owners included**. The generator now adds a
     baseline membership policy first. Test *outcomes*, not just "applied
     clean", and always run each migration **twice** for idempotency.
   Pattern used: `docker run -d --rm --name pg -e POSTGRES_PASSWORD=test
   postgres:15-alpine`, create a `auth.uid()` stub reading a GUC
   (`current_setting('test.uid')`), `CREATE ROLE authenticated service_role
   anon`, then `SET ROLE authenticated; SET test.uid='…'` to simulate users.
2. **This schema has drifted badly from the migrations folder.** Repeatedly,
   code wrote columns that no migration ever created, or migrations were
   only partly applied. **Probe the live DB before assuming a column
   exists.** Known past instances: `messages.reply_to_message_id`,
   `message_templates.{header_media_url,meta_template_id,quality_score,
   sample_values,header_handle,submission_error,rejection_reason,
   last_submitted_at}`, `message_reactions` missing its UNIQUE constraint,
   `whatsapp_config.app_secret`.
3. **`profiles.account_id` DOES NOT EXIST.** The schema is
   `workspace_id`-based. Many routes queried it and 403'd for every user
   (reactions, template submit/sync/edit/delete, media upload, flows). If
   you see `account_id` on anything except `account_invitations`, it's a bug.
4. **Phone matching**: use `isSamePhoneNumber()` / `findContactByPhoneDigits()`.
   Do **not** match on "same last 8 digits" — real data contains
   `+255000000001`, `+240000000001`, `+270000000001` (three countries, one
   8-digit tail) and merging them would cross customers' chats.
5. **Storage**: uploads go through `POST /api/storage/upload` (service role,
   membership-checked). Direct client uploads fail — the buckets have no
   RLS policies. Buckets `chat-media` and `flow-media` were created by me.
6. **Don't "fix" the remaining `react-hooks/exhaustive-deps` warnings.**
   ~15 name un-memoised fetch functions; adding them causes infinite fetch
   loops. The `resyncToken` deps ESLint calls "unnecessary" are
   load-bearing (they force a resync by changing callback identity).
7. **The ~500 remaining `any`s are one root cause**: Supabase clients are
   created without the generated `Database` generic, so all query results
   are untyped. 141 more are `catch (err: any)` where `unknown` breaks
   `err.message` under strict mode. Don't paper over these with disable
   comments; fixing properly means generating DB types.
8. **Lint counts**: `.claude/worktrees/`, `graphify-out/` and `scratch/` are
   eslint-ignored — they were 5,037 phantom problems. Real debt is ~576.

## 6. Constraints / things that are NOT possible

- **Calling feature**: the WhatsApp Business Calling API is real, but the
  number reports `calling.status: NOT_SET` and Meta requires a ≥2,000
  business-initiated conversations/24h tier. Plus WebRTC + signalling + UI
  — a multi-week project. Assessed, deliberately not started.
- **No SQL/DDL access from code**: there is no `exec_sql` RPC, no `psql`,
  no Supabase CLI locally. Migrations must be pasted by the user. You *can*
  do data/storage work via the service-role client and the Storage API.
- **Authenticated UI cannot be click-tested by the agent** — session
  injection is blocked by the permission classifier and creating test users
  in the production DB is off-limits. Verify via types/tests/build + live
  API probes, and say plainly what you could not verify.

## 7. Useful probes (copy-paste)

Check which migrations are pending (run from repo root):
```bash
node -e "require('dotenv').config({path:'.env.local',quiet:true});const{createClient}=require('@supabase/supabase-js');(async()=>{const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const nil='00000000-0000-0000-0000-000000000000';
const t=[['072 template cols',async()=>(await c.from('message_templates').select('header_media_url').limit(1)).error],
['073 module keys',async()=>{const{data}=await c.from('workspace_roles').select('permissions').limit(1).maybeSingle();return (data&&'module_crm' in (data.permissions||{}))?null:{message:'absent'}}],
['074 has_resource_permission',async()=>(await c.rpc('has_resource_permission',{p_workspace_id:nil,p_user_id:nil,p_resource:'contacts',p_action:'read',p_module:'crm'})).error]];
for(const[n,f]of t){const e=await f();console.log((e?'PENDING  ':'applied  ')+n)}})()"
```

Production webhook + app-secret diagnostics (needs a logged-in browser
cookie, or set `ADMIN_DIAG_TOKEN`): `GET /api/admin/webhook-status` →
look at `appSecretChecks`, `wabaSubscriptions`, `webhookLogs`.

Gates before any commit: `npx tsc --noEmit`, `npx vitest run`, `npm run build`.

## 8. OPEN WORK (pick up here)

**Awaiting the user's decision — do not act unilaterally:**
1. **58 duplicate contact numbers** in production. Mixed causes: true
   duplicates (same name twice), and legitimately shared business lines
   (four "More Supermarket" branches on one number) which must **not** be
   merged. Offer a read-only preview first, then a merge script that only
   touches unambiguous same-name duplicates.
2. **Flows/chatbot has no RBAC coverage** — `flows`/`flow_runs` are
   `user_id`-scoped, not `workspace_id`, so they're outside the resource
   catalog. Closing this needs a schema change + backfill.
3. **Proven-unreferenced but possibly staged work** (don't delete without
   asking): `src/lib/contacts/dedupe.ts`, `parse-contact-csv.ts`,
   `src/lib/hr/attendance/attendance-engine.ts`,
   `src/components/presence/presence-heartbeat.tsx`, three
   `src/components/projects/project-{activity-log,invoices,timesheet}.tsx`
   behind disabled tabs, `src/components/ui/{radio-group,separator}.tsx`.

**Ready to do:**
4. After the user applies the bundle: **verify the RBAC round-trips** in the
   real app — create a role, restrict a module, assign it to a member,
   confirm the UI hides it and the DB refuses the data.
5. Optional hardening: prevent an admin ticking *write* permissions on the
   built-in "Viewer" role (currently possible; makes the name misleading).
6. Optional: generate Supabase `Database` types to kill ~150 `any`s (§5.7).
7. `src/app/api/account/members/[userId]/route.ts` has a **stale header
   comment** claiming it delegates to SECURITY DEFINER RPCs from migration
   018 — it has no `.rpc()` calls at all. Two divergent copies of
   `rpcErrorToResponse` also remain (different status codes), so
   consolidating them would change HTTP responses — reported, not done.

**Communication style the user expects**: lead with the outcome, be
explicit about what was verified vs. assumed, and flag risky/destructive
actions before doing them. They are the technical owner and act on precise
instructions (e.g. "run this migration", "fix this env var").
