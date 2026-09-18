/**
 * Where a media file's bytes actually live.
 *
 * Two eras exist in `media_files`:
 *   • storage_path set → the object is in the private `media-files`
 *     bucket and is read through /api/media/file, which checks
 *     workspace membership first.
 *   • storage_path null → a LEGACY row from when uploads were written
 *     to the container filesystem (public/uploads/…). Those bytes did
 *     not survive container restarts, so the link is dead. The UI says
 *     so instead of opening a 404.
 */

export interface MediaFileRef {
  id: string;
  local_path?: string | null;
  storage_path?: string | null;
}

/** True when the row predates durable storage — its bytes are gone. */
export function isLegacyMedia(file: MediaFileRef): boolean {
  return !file.storage_path;
}

/**
 * The href to open a file, or null when there is nothing to open.
 * Legacy rows deliberately return null rather than the old
 * /uploads/… path: that path 404s, and a dead link that looks alive is
 * worse than an honest "file missing".
 */
export function mediaHref(file: MediaFileRef): string | null {
  if (file.storage_path) return `/api/media/file?id=${encodeURIComponent(file.id)}`;
  return null;
}
