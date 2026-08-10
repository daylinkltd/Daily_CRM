import { Fragment } from 'react';

import { API_KEY_PREFIX } from '@/lib/api-keys/keys';
import { SCOPE_DESCRIPTIONS, SCOPE_GROUPS } from '@/lib/api-keys/scopes';
import { V1_PATHS } from '@/lib/api/v1/resource-registry';

/**
 * Developer documentation for the public REST API.
 *
 * Kept in-app (rather than on an external docs site) so it can import
 * the real constants — the key prefix and scope table below are the
 * same values the server enforces, so the docs can't drift from the
 * code.
 */

const BASE_URL = 'https://dailycrm.cloud';

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-none bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">
      {children}
    </code>
  );
}

function Snippet({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted/60 p-4 text-[13px] leading-relaxed">
      <code className="font-mono text-foreground">{children}</code>
    </pre>
  );
}

function Endpoint({
  method,
  path,
  scope,
  children,
}: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  scope: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            method === 'POST'
              ? 'rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs font-semibold text-primary'
              : 'rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground'
          }
        >
          {method}
        </span>
        <span className="font-mono text-sm font-medium text-foreground">{path}</span>
        <span className="ml-auto rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {scope}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-foreground">API Documentation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send WhatsApp messages, manage contacts and track delivery status from
          your own systems.
        </p>
      </div>

      {/* Authentication */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Authentication</h2>
        <p className="text-sm text-muted-foreground">
          Create a key under <Code>Settings → API keys</Code>. The plaintext key
          is shown once — store it in your secret manager. Every request carries
          it as a bearer token, and every key is bound to the workspace that
          created it, so it can only ever read or write that workspace&apos;s
          data.
        </p>
        <Snippet>{`curl ${BASE_URL}/api/v1/me \\
  -H "Authorization: Bearer ${API_KEY_PREFIX}your_key_here"`}</Snippet>
        <p className="text-sm text-muted-foreground">
          Keys issued before the Dailybiz rename (prefix{' '}
          <Code>wacrm_live_</Code>) keep working — you don&apos;t need to rotate
          them, though newly created keys use <Code>{API_KEY_PREFIX}</Code>.
        </p>
      </section>

      {/* Scopes */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Scopes</h2>
        <p className="text-sm text-muted-foreground">
          A key can do exactly what its scopes allow. Grant the minimum each
          integration needs; a missing scope returns <Code>403 forbidden</Code>.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              {SCOPE_GROUPS.map((group) => (
                <Fragment key={group.label}>
                  <tr className="border-b border-border bg-muted/50">
                    <td
                      colSpan={2}
                      className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {group.label}
                    </td>
                  </tr>
                  {group.scopes.map((scope) => (
                    <tr key={scope} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-[13px] text-foreground">
                        {scope}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {SCOPE_DESCRIPTIONS[scope]}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sending */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Sending a message
        </h2>
        <Endpoint method="POST" path="/api/v1/messages" scope="messages:send">
          Address the recipient with <Code>phone</Code>, <Code>contact_id</Code>{' '}
          or <Code>conversation_id</Code>. With <Code>phone</Code>, the contact
          and conversation are created when they don&apos;t exist yet — matched
          on digits, so <Code>+91 99023 19132</Code> and{' '}
          <Code>919902319132</Code> resolve to the same contact rather than
          creating a duplicate.
        </Endpoint>
        <Snippet>{`curl -X POST ${BASE_URL}/api/v1/messages \\
  -H "Authorization: Bearer ${API_KEY_PREFIX}your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+919876543210",
    "type": "text",
    "text": "Your order #10245 has shipped."
  }'`}</Snippet>
        <p className="text-sm text-muted-foreground">
          Response (<Code>201</Code>):
        </p>
        <Snippet>{`{
  "data": {
    "id": "8f2c…",                     // CRM message id
    "whatsapp_message_id": "wamid.…",  // Meta's id
    "conversation_id": "1a4b…",
    "contact_id": "77de…",
    "status": "sent"
  }
}`}</Snippet>

        <h3 className="pt-2 text-sm font-semibold text-foreground">
          The 24-hour rule
        </h3>
        <p className="text-sm text-muted-foreground">
          WhatsApp only allows free-form text within 24 hours of the
          customer&apos;s last message. Outside that window — including any
          first contact — you must send an approved template, otherwise Meta
          rejects the send and the returned error explains why.
        </p>
        <Snippet>{`curl -X POST ${BASE_URL}/api/v1/messages \\
  -H "Authorization: Bearer ${API_KEY_PREFIX}your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+919876543210",
    "type": "template",
    "template_name": "order_confirmation",
    "template_language": "en_US",
    "template_params": ["Priya", "#10245", "INR 2,499"]
  }'`}</Snippet>
        <p className="text-sm text-muted-foreground">
          <Code>template_params</Code> fill the <Code>{'{{1}}'}</Code>,{' '}
          <Code>{'{{2}}'}</Code> … placeholders in order. Templates must be
          approved by Meta first — see{' '}
          <Code>Settings → Templates → Library</Code> for ready-made ones you
          can submit in one click.
        </p>
      </section>

      {/* Status */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Delivery status
        </h2>
        <p className="text-sm text-muted-foreground">
          Status advances on its own as Meta reports progress:{' '}
          <Code>sent</Code> → <Code>delivered</Code> → <Code>read</Code>, or{' '}
          <Code>failed</Code>. Poll either endpoint below — no webhook setup is
          needed on your side.
        </p>
        <Endpoint
          method="GET"
          path="/api/v1/messages/{id}"
          scope="messages:read"
        >
          Accepts the CRM message id or the <Code>wamid…</Code> returned when
          you sent it.
        </Endpoint>
        <Snippet>{`curl ${BASE_URL}/api/v1/messages/wamid.HBgM… \\
  -H "Authorization: Bearer ${API_KEY_PREFIX}your_key_here"`}</Snippet>
        <Endpoint method="GET" path="/api/v1/messages" scope="messages:read">
          Lists messages newest-first, inbound and outbound. Filter by{' '}
          <Code>conversation_id</Code>, <Code>contact_id</Code> or{' '}
          <Code>status</Code>; paginate with <Code>limit</Code> (max 100) and{' '}
          <Code>offset</Code>. The response includes <Code>has_more</Code>.
        </Endpoint>
        <Snippet>{`curl "${BASE_URL}/api/v1/messages?status=failed&limit=50" \\
  -H "Authorization: Bearer ${API_KEY_PREFIX}your_key_here"`}</Snippet>
        <p className="text-sm text-muted-foreground">
          Every message carries a <Code>direction</Code> of{' '}
          <Code>inbound</Code> or <Code>outbound</Code>, so the same endpoint
          lets you read customer replies.
        </p>
      </section>

      {/* Contacts */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Contacts</h2>
        <Endpoint method="POST" path="/api/v1/contacts" scope="contacts:write">
          Creates a contact, or updates the existing one when that number is
          already in the workspace. Accepts <Code>phone</Code> (required),{' '}
          <Code>name</Code>, <Code>email</Code>, <Code>company</Code> and{' '}
          <Code>tags</Code>.
        </Endpoint>
        <Endpoint method="GET" path="/api/v1/me" scope="none">
          Returns the workspace a key belongs to and the scopes it holds —
          handy as a credential health check.
        </Endpoint>
      </section>

      {/* Every other resource */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          All modules ({V1_PATHS.length} endpoints)
        </h2>
        <p className="text-sm text-muted-foreground">
          Every resource in CRM, HR, retail, accounting and projects is
          reachable through one uniform set of endpoints. Substitute the
          resource name below for <Code>{'{resource}'}</Code>.
        </p>
        <Endpoint method="GET" path="/api/v1/{resource}" scope="{resource}:read">
          Lists rows in your workspace. Supports <Code>limit</Code> (max 200,
          default 50), <Code>offset</Code>, and <Code>order</Code> with{' '}
          <Code>dir=asc|desc</Code>. Responds with{' '}
          <Code>{'{ items, pagination: { limit, offset, total } }'}</Code>.
        </Endpoint>
        <Endpoint method="POST" path="/api/v1/{resource}" scope="{resource}:write">
          Creates a row. <Code>workspace_id</Code> is taken from your key and
          ignored in the body, so a key can only ever write into its own
          workspace. Returns <Code>201</Code>.
        </Endpoint>
        <Endpoint method="GET" path="/api/v1/{resource}/{id}" scope="{resource}:read">
          Fetches one row. A row belonging to another workspace returns{' '}
          <Code>404</Code>, never <Code>403</Code>.
        </Endpoint>
        <Endpoint
          method="PATCH"
          path="/api/v1/{resource}/{id}"
          scope="{resource}:write"
        >
          Updates the supplied fields only. <Code>id</Code> and{' '}
          <Code>workspace_id</Code> are ignored.
        </Endpoint>
        <Endpoint
          method="DELETE"
          path="/api/v1/{resource}/{id}"
          scope="{resource}:delete"
        >
          Deletes the row. Split from <Code>:write</Code> so a key can create
          and edit without being able to destroy.
        </Endpoint>
        <Snippet>{`curl "${BASE_URL}/api/v1/payroll?limit=10&order=created_at" \\
  -H "Authorization: Bearer ${API_KEY_PREFIX}…"`}</Snippet>
        <p className="text-sm text-muted-foreground">
          Resource names, grouped by module:
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              {SCOPE_GROUPS.filter((g) => g.module).map((group) => (
                <tr key={group.label} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 align-top text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </td>
                  <td className="px-4 py-2 font-mono text-[13px] text-foreground">
                    {V1_PATHS.filter((r) => r.module === group.module)
                      .map((r) => r.path)
                      .sort()
                      .join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Errors + limits */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Errors &amp; rate limits
        </h2>
        <p className="text-sm text-muted-foreground">
          Failures share one shape. Branch on <Code>code</Code>, which is
          stable; <Code>message</Code> is human-facing and may be reworded.
        </p>
        <Snippet>{`{ "error": { "code": "forbidden", "message": "This API key is missing the 'messages:send' scope" } }`}</Snippet>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              {[
                ['401 unauthorized', 'Key missing, malformed, revoked or expired'],
                [
                  '403 forbidden',
                  'Key lacks the required scope, or the plan quota is exhausted',
                ],
                ['404 not_found', "Resource doesn't exist in this workspace"],
                [
                  '429 rate_limited',
                  'Budget exhausted — see the Retry-After and X-RateLimit-* headers',
                ],
                ['502 internal', 'WhatsApp rejected the send; the message explains why'],
              ].map(([code, meaning]) => (
                <tr key={code} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[13px] text-foreground">
                    {code}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Requests are limited to 120 per minute per key. Plan message quotas
          apply to API sends exactly as they do in the dashboard.
        </p>
      </section>
    </div>
  );
}
