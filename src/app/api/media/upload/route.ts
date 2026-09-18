import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { v4 as uuidv4 } from "uuid";

/**
 * Uploads go to the private `media-files` bucket (migration 135), NOT
 * to the container filesystem. The old code wrote to
 * public/uploads/<Workspace>/… — a path that ships empty in the image
 * and lives only in the container's writable layer, so every Coolify
 * deploy deleted every document while leaving its DB row behind.
 *
 * Object key: <workspace_id>/<folder>/<uuid>-<name>.<ext> — keyed by
 * ID, not by workspace NAME, so renaming a workspace or a deal can
 * never orphan files.
 */
const BUCKET = "media-files";
const MAX_BYTES = 50 * 1024 * 1024; // matches the bucket's limit

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const workspaceId = formData.get("workspace_id") as string;
    const folderId = formData.get("folder_id") as string | null;
    const dealId = formData.get("deal_id") as string | null;
    const autoFolder = formData.get("auto_folder") as string | null; // e.g. deal name
    
    // Helper to sanitize path components
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();

    if (!file || !workspaceId) {
      return NextResponse.json({ error: "Missing file or workspace_id" }, { status: 400 });
    }

    // Check active workspace member
    const { data: isMember } = await supabase.rpc('is_active_workspace_member', {
      p_workspace_id: workspaceId,
      p_user_id: user.id
    });
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let targetFolderId = folderId;

    // Auto-create folder for deals if needed
    if (autoFolder && autoFolder !== 'null') {
      // Find if folder exists
      const { data: existingFolder } = await supabase
        .from("media_folders")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("name", autoFolder)
        .is("parent_id", null)
        .maybeSingle();
      
      if (existingFolder) {
        targetFolderId = existingFolder.id;
      } else {
        const { data: newFolder, error: folderErr } = await supabase
          .from("media_folders")
          .insert({ workspace_id: workspaceId, name: autoFolder })
          .select()
          .single();
        if (folderErr) throw folderErr;
        targetFolderId = newFolder.id;
      }
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 50 MB limit." },
        { status: 413 },
      );
    }

    // Folder segment is for humans reading the bucket; the workspace id
    // prefix is what isolation keys on.
    let subFolderPath = '';
    if (dealId && dealId !== 'null') {
      const { data: dealData } = await supabase.from('deals').select('title').eq('id', dealId).single();
      if (dealData) subFolderPath = sanitize(dealData.title);
    } else if (targetFolderId && targetFolderId !== 'null') {
      const { data: folderData } = await supabase.from('media_folders').select('name').eq('id', targetFolderId).single();
      if (folderData) subFolderPath = sanitize(folderData.name);
    } else if (autoFolder) {
      subFolderPath = sanitize(autoFolder);
    }

    const uniqueId = uuidv4();
    // Sanitize the extension as well as the stem — an unsanitized
    // extension is how a crafted name escapes its prefix.
    const rawExtension = file.name.split('.').pop() || 'bin';
    const extension =
      rawExtension.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'bin';
    const sanitizedOriginalName = sanitize(file.name.replace(/\.[^.]*$/, '')).replace(/\s+/g, '-');
    const savedName = `${sanitizedOriginalName || 'file'}_${uniqueId.substring(0, 8)}.${extension}`;

    const folderSegment = subFolderPath ? `${subFolderPath.replace(/\s+/g, '-')}/` : '';
    const storagePath = `${workspaceId}/${folderSegment}${savedName}`;

    const admin = createAdminClient();
    const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (upErr) {
      console.error('[media/upload] storage upload failed:', upErr);
      return NextResponse.json(
        { error: `Upload failed: ${upErr.message}` },
        { status: 500 },
      );
    }

    // Insert into DB
    const insertData: any = {
      workspace_id: workspaceId,
      name: file.name,
      mime_type: file.type,
      file_size: file.size,
      // local_path is NOT NULL and predates the bucket; it now holds the
      // same key so nothing reads a stale /uploads/… URL.
      local_path: storagePath,
      storage_path: storagePath,
    };
    if (targetFolderId && targetFolderId !== 'null') insertData.folder_id = targetFolderId;
    if (dealId && dealId !== 'null') insertData.deal_id = dealId;

    const { data: dbFile, error: dbErr } = await supabase
      .from("media_files")
      .insert(insertData)
      .select()
      .single();
    
    if (dbErr) {
      // The bytes are already in the bucket; without the row nothing
      // will ever reference them, so remove the orphan rather than
      // leaving storage to accumulate files nobody can see.
      await admin.storage.from(BUCKET).remove([storagePath]);
      throw dbErr;
    }

    return NextResponse.json({ success: true, file: dbFile });

  } catch (error: any) {
    console.error("[upload error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
