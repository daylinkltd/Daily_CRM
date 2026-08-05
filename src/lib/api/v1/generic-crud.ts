// ============================================================
// Public API (v1) — catalog-driven CRUD handlers.
//
// The logic lives here rather than in the route files so the dynamic
// `/api/v1/[resource]` routes and the hand-written static ones can share
// it. `/api/v1/contacts` is the reason: it has bespoke POST behaviour
// (phone normalisation, tag resolution) but no reason to reimplement
// listing, and as a static route it shadows the dynamic segment — so
// without this it would answer 405 to GET while `contacts:read` was
// grantable.
//
// SECURITY: see the header of resource-registry.ts. Three invariants are
// enforced here, on every path:
//
//   1. The resource comes from the allow-list; unknown → 404.
//   2. Every query is constrained to the key's workspace.
//   3. `workspace_id` and `id` are stripped from request bodies.
//
// The client is service-role (an API key has no auth.uid(), so there is
// no RLS). Rule 2 is the only thing standing between a caller and other
// tenants' rows — do not add a query here that skips it.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { requireApiKey } from '@/lib/auth/api-context';
import { ok, toApiErrorResponse, badRequest, notFound } from '@/lib/api/v1/respond';
import {
  findV1Resource,
  scopedSelect,
  workspaceFilterColumn,
  ownsWorkspaceColumn,
  type V1Resource,
} from '@/lib/api/v1/resource-registry';

/** Hard ceiling on page size — an unbounded list is a denial-of-service. */
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/** Database messages that mean "the caller sent something wrong". */
const CALLER_ERROR =
  /does not exist|invalid input|violates check constraint|violates not-null|violates unique constraint/i;

function resolve(key: string): V1Resource {
  const resource = findV1Resource(key);
  if (!resource) throw notFound(`Unknown resource '${key}'`);
  return resource;
}

function parsePagination(url: URL): { limit: number; offset: number } {
  const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const rawOffset = Number(url.searchParams.get('offset') ?? 0);

  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  return { limit, offset };
}

/**
 * The column `/<path>/<id>` addresses. Tables with composite keys have
 * none, so the item routes are simply unavailable for them.
 */
function requirePrimaryKey(resource: V1Resource): string {
  if (!resource.primaryKey) {
    throw badRequest(
      `'${resource.path}' has a composite primary key and cannot be addressed as /${resource.path}/{id}. Use the collection endpoint.`
    );
  }
  return resource.primaryKey;
}

function readJsonObject(
  body: unknown,
  resource: V1Resource,
  { stripKey }: { stripKey: boolean }
): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Body must be a JSON object');
  }
  const payload = { ...(body as Record<string, unknown>) };
  // Moving a row between tenants is never a legitimate write.
  delete payload.workspace_id;
  // On update, re-keying a row is never legitimate either. On create the
  // key may be required — composite join tables ARE their keys.
  if (stripKey && resource.primaryKey) delete payload[resource.primaryKey];
  return payload;
}

/**
 * Confirm a row is inside the caller's workspace before mutating it.
 *
 * Parent-scoped resources cannot be filtered by workspace in an UPDATE or
 * DELETE — PostgREST applies embedded filters to reads only — so ownership
 * is established with a read first and the mutation is then keyed by
 * primary key. Workspace-scoped resources pay the same cheap lookup so
 * both paths return a truthful 404 rather than a silent no-op.
 */
async function assertRowInWorkspace(
  supabase: SupabaseClient,
  resource: V1Resource,
  id: string,
  workspaceId: string
): Promise<void> {
  const pk = requirePrimaryKey(resource);
  const { data } = await supabase
    .from(resource.table)
    .select(scopedSelect(resource, pk))
    .eq(pk, id)
    .eq(workspaceFilterColumn(resource), workspaceId)
    .maybeSingle();

  if (!data) throw notFound(`No ${resource.path} with ${pk} '${id}'`);
}

export async function listResource(
  request: Request,
  resourceKey: string
): Promise<NextResponse> {
  try {
    const resource = resolve(resourceKey);
    const ctx = await requireApiKey(request, `${resource.scopeKey}:read`);

    const url = new URL(request.url);
    const { limit, offset } = parsePagination(url);

    let query = ctx.supabase
      .from(resource.table)
      .select(scopedSelect(resource), { count: 'exact' })
      .eq(workspaceFilterColumn(resource), ctx.accountId)
      .range(offset, offset + limit - 1);

    // `order` is opt-in: not every table has created_at, and naming a
    // missing column makes PostgREST reject the whole request.
    const order = url.searchParams.get('order');
    if (order) {
      const desc = (url.searchParams.get('dir') ?? 'desc').toLowerCase() === 'desc';
      query = query.order(order, { ascending: !desc });
    }

    const { data, error, count } = await query;
    if (error) {
      if (CALLER_ERROR.test(error.message)) throw badRequest(error.message);
      throw error;
    }

    return ok({
      resource: resource.path,
      module: resource.module,
      items: data ?? [],
      pagination: { limit, offset, total: count ?? 0 },
    });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function createResource(
  request: Request,
  resourceKey: string
): Promise<NextResponse> {
  try {
    const resource = resolve(resourceKey);
    const ctx = await requireApiKey(request, `${resource.scopeKey}:write`);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw badRequest('Invalid JSON body');
    }
    const payload = readJsonObject(body, resource, { stripKey: false });

    if (ownsWorkspaceColumn(resource)) {
      payload.workspace_id = ctx.accountId;
    } else if (resource.scoping.kind === 'parent') {
      // Parent-scoped rows inherit their workspace from the parent, so the
      // FK is required AND must be verified — otherwise a caller could
      // attach a row to another tenant's parent.
      const fkValue = payload[resource.scoping.fk];
      if (typeof fkValue !== 'string' || !fkValue) {
        throw badRequest(`'${resource.scoping.fk}' is required`);
      }
      const { data: parent } = await ctx.supabase
        .from(resource.scoping.parent)
        .select('id')
        .eq('id', fkValue)
        .eq('workspace_id', ctx.accountId)
        .maybeSingle();
      if (!parent) {
        throw badRequest(
          `'${resource.scoping.fk}' does not reference a ${resource.scoping.parent} row in this workspace`
        );
      }
    }

    const { data, error } = await ctx.supabase
      .from(resource.table)
      .insert(payload)
      .select()
      .single();

    if (error) {
      // Unknown column, bad enum, failed check — all caller mistakes.
      // Surfacing the database wording beats an opaque 500.
      if (CALLER_ERROR.test(error.message)) throw badRequest(error.message);
      throw error;
    }

    return ok({ resource: resource.path, item: data }, 201);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function getResource(
  request: Request,
  resourceKey: string,
  id: string
): Promise<NextResponse> {
  try {
    const resource = resolve(resourceKey);
    const ctx = await requireApiKey(request, `${resource.scopeKey}:read`);

    const pk = requirePrimaryKey(resource);
    const { data, error } = await ctx.supabase
      .from(resource.table)
      .select(scopedSelect(resource))
      .eq(pk, id)
      .eq(workspaceFilterColumn(resource), ctx.accountId)
      .maybeSingle();

    if (error) {
      if (CALLER_ERROR.test(error.message)) throw badRequest(error.message);
      throw error;
    }
    // A row in another workspace is reported as absent, not forbidden —
    // 403 would confirm the id exists somewhere.
    if (!data) throw notFound(`No ${resource.path} with id '${id}'`);

    return ok({ resource: resource.path, item: data });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function updateResource(
  request: Request,
  resourceKey: string,
  id: string
): Promise<NextResponse> {
  try {
    const resource = resolve(resourceKey);
    const ctx = await requireApiKey(request, `${resource.scopeKey}:write`);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw badRequest('Invalid JSON body');
    }
    const payload = readJsonObject(body, resource, { stripKey: true });
    if (Object.keys(payload).length === 0) {
      throw badRequest('No updatable fields supplied');
    }

    await assertRowInWorkspace(ctx.supabase, resource, id, ctx.accountId);

    const { data, error } = await ctx.supabase
      .from(resource.table)
      .update(payload)
      .eq(requirePrimaryKey(resource), id)
      .select();

    if (error) {
      if (CALLER_ERROR.test(error.message)) throw badRequest(error.message);
      throw error;
    }
    // `.select()` on the mutation is what makes a zero-row UPDATE
    // detectable at all — Supabase reports { error: null } otherwise.
    if (!data || data.length === 0) {
      throw notFound(`No ${resource.path} with id '${id}'`);
    }

    return ok({ resource: resource.path, item: data[0] });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function deleteResource(
  request: Request,
  resourceKey: string,
  id: string
): Promise<NextResponse> {
  try {
    const resource = resolve(resourceKey);
    const ctx = await requireApiKey(request, `${resource.scopeKey}:delete`);

    await assertRowInWorkspace(ctx.supabase, resource, id, ctx.accountId);

    const { data, error } = await ctx.supabase
      .from(resource.table)
      .delete()
      .eq(requirePrimaryKey(resource), id)
      .select();

    if (error) {
      // Usually a parent that still has children. Caller problem.
      if (/violates foreign key constraint/i.test(error.message)) {
        throw badRequest(error.message);
      }
      throw error;
    }
    if (!data || data.length === 0) {
      throw notFound(`No ${resource.path} with id '${id}'`);
    }

    return ok({ resource: resource.path, deleted: id });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
