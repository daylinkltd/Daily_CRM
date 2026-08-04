// ============================================================
// Public API (v1) — generic collection endpoint.
//
//   GET  /api/v1/<resource>        list, paginated
//   POST /api/v1/<resource>        create
//
// One route serves every resource in the catalog (CRM, HR, retail,
// accounting, projects) instead of ~100 near-identical files. Behaviour
// and the security rules live in `@/lib/api/v1/generic-crud`.
//
// Static siblings win over this dynamic segment in Next's route matching,
// so `/api/v1/contacts`, `/api/v1/messages` and `/api/v1/me` keep their
// bespoke handlers.
// ============================================================

import { listResource, createResource } from '@/lib/api/v1/generic-crud';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> }
) {
  const { resource } = await params;
  return listResource(request, resource);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> }
) {
  const { resource } = await params;
  return createResource(request, resource);
}
