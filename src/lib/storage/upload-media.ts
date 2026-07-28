/**
 * Shared media-upload helper for the public media buckets (chat
 * attachments, flow media, template headers).
 *
 * Uploads are routed through POST /api/storage/upload (service role
 * on the server) — the buckets have no storage RLS policies, so a
 * direct client upload is rejected. The server namespaces objects
 * under `account-<workspace_id>/` and enforces workspace membership.
 *
 * (A previous version uploaded directly from the browser and resolved
 * a nonexistent profiles.account_id column — every upload failed with
 * "Could not resolve your account".)
 */

/** 16 MB — matches the `file_size_limit` on the media buckets. */
export const MEDIA_MAX_BYTES = 16 * 1024 * 1024;

/**
 * Human-readable size guard message. Meta's own per-type limits are
 * stricter for some types (e.g. 5 MB images) — callers with a
 * tighter limit should check before calling; this is the ceiling.
 */
export const MEDIA_MAX_LABEL = "16 MB";

/**
 * Per-kind upload ceilings that mirror Meta's WhatsApp Cloud API caps so
 * a file that the bucket would accept (≤16 MB) but Meta would reject is
 * caught client-side BEFORE upload — otherwise it lands in storage as an
 * orphan and the send fails with a confusing 400. Images are Meta's
 * tightest cap at 5 MB; documents are held at the 16 MB bucket limit
 * (Meta allows 100 MB, but the bucket — and shared-hosting upload UX —
 * caps lower).
 */
export const MEDIA_MAX_BYTES_BY_KIND = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
} as const;

export interface UploadAccountMediaResult {
  /** Public URL Meta can fetch at send time. */
  publicUrl: string;
  /** Storage object path (workspace-scoped). */
  path: string;
}

/**
 * Upload a file to a workspace-scoped Storage bucket and return its
 * public URL. Throws with a user-facing message on auth / upload
 * failure — callers surface it via a toast.
 *
 * Size validation is the caller's responsibility (limits can differ per
 * feature); `MEDIA_MAX_BYTES` is exported for the common case.
 */
export async function uploadAccountMedia(
  bucket: string,
  file: File,
): Promise<UploadAccountMediaResult> {
  const form = new FormData();
  form.set("file", file);
  form.set("bucket", bucket);

  const res = await fetch("/api/storage/upload", {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Upload failed.");
  }
  return { publicUrl: data.publicUrl, path: data.path };
}

/**
 * Delete a previously-uploaded object. Used to GC media that was staged
 * (uploaded) but never sent — a cancelled draft or a failed Meta send —
 * so abandoned attachments don't accumulate in the public bucket. The
 * server only allows deletes inside the caller's own workspace prefix.
 *
 * Best-effort: callers fire-and-forget and swallow errors (a missed
 * delete is a storage nit, not something to surface to the user).
 */
export async function deleteAccountMedia(
  bucket: string,
  path: string,
): Promise<void> {
  const res = await fetch("/api/storage/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, path }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Delete failed.");
  }
}
