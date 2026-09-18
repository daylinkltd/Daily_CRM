// ============================================================
// GET /api/media/file?id=<media_files.id>
//
// The only way to read a CRM media file. Uploads used to be written to
// public/uploads/… and served by the static handler, which meant two
// problems at once: the bytes vanished with the container on every
// deploy, and while they existed ANYONE with the URL could read them —
// no session, no membership check, across tenants.
//
// Now the bucket is private and every read passes through here:
// session → workspace membership → stream. `download=1` forces a save
// dialog instead of inline rendering.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "media-files";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read the row with the ADMIN client and check membership explicitly.
  // Relying on the caller's RLS view would hide the difference between
  // "not yours" and "deleted", and this route needs to tell the user
  // which one happened.
  const admin = createAdminClient();
  const { data: file } = await admin
    .from("media_files")
    .select("id, workspace_id, name, mime_type, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", file.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!file.storage_path) {
    // A legacy row: uploaded when files lived on the container's disk,
    // which did not survive deploys. Say exactly that — a bare 404 sent
    // people hunting for a permissions bug that was never there.
    return NextResponse.json(
      {
        error:
          "This file was uploaded before Dailybuz moved to durable storage and its contents are no longer available. Please upload it again.",
        code: "legacy_missing",
        name: file.name,
      },
      { status: 410 },
    );
  }

  const { data: blob, error } = await admin.storage.from(BUCKET).download(file.storage_path);
  if (error || !blob) {
    console.error("[media/file] download failed:", error?.message);
    return NextResponse.json({ error: "File is missing from storage" }, { status: 404 });
  }

  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  // The filename is user-supplied: quotes and newlines would let it
  // break out of the header value, so it is sent percent-encoded.
  const safeName = encodeURIComponent(file.name || "file");

  return new NextResponse(blob.stream(), {
    headers: {
      "Content-Type": file.mime_type || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${safeName}`,
      // Private: this is tenant data behind a membership check; shared
      // caches must never hold it.
      "Cache-Control": "private, max-age=300",
    },
  });
}
