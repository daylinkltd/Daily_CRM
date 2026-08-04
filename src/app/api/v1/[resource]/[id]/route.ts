// ============================================================
// Public API (v1) — generic item endpoint.
//
//   GET    /api/v1/<resource>/<id>
//   PATCH  /api/v1/<resource>/<id>
//   DELETE /api/v1/<resource>/<id>
//
// Companion to the collection route. Behaviour and the security rules
// live in `@/lib/api/v1/generic-crud`.
// ============================================================

import {
  getResource,
  updateResource,
  deleteResource,
} from '@/lib/api/v1/generic-crud';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  const { resource, id } = await params;
  return getResource(request, resource, id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  const { resource, id } = await params;
  return updateResource(request, resource, id);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  const { resource, id } = await params;
  return deleteResource(request, resource, id);
}
