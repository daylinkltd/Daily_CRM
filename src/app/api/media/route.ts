import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspace_id");
    const parentId = searchParams.get("parent_id"); // null for root

    if (!workspaceId) {
      return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
    }

    // Folders
    let foldersQuery = supabase.from("media_folders").select("*").eq("workspace_id", workspaceId);
    if (parentId && parentId !== 'null') {
      foldersQuery = foldersQuery.eq("parent_id", parentId);
    } else {
      foldersQuery = foldersQuery.is("parent_id", null);
    }
    const { data: folders, error: fErr } = await foldersQuery.order('name');
    if (fErr) throw fErr;

    // Files
    let filesQuery = supabase.from("media_files").select("*").eq("workspace_id", workspaceId);
    if (parentId && parentId !== 'null') {
      filesQuery = filesQuery.eq("folder_id", parentId);
    } else {
      filesQuery = filesQuery.is("folder_id", null);
    }
    const { data: files, error: filErr } = await filesQuery.order('created_at', { ascending: false });
    if (filErr) throw filErr;

    return NextResponse.json({ folders, files });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("file_id");
    const folderId = searchParams.get("folder_id");

    if (fileId) {
      const { data: file } = await supabase.from("media_files").select("*").eq("id", fileId).single();
      if (file) {
        // Remove the object. Legacy rows (storage_path null) have no
        // object to remove — their bytes died with the container that
        // wrote them, so there is only the row to clear.
        if (file.storage_path) {
          const { error: rmErr } = await createAdminClient()
            .storage.from("media-files")
            .remove([file.storage_path]);
          if (rmErr) console.error("Failed to remove stored object", rmErr.message);
        }
        await supabase.from("media_files").delete().eq("id", fileId);
      }
    }

    if (folderId) {
      // We would ideally fetch all nested files and unlink them, but deleting the DB record cascades.
      await supabase.from("media_folders").delete().eq("id", folderId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Create folder
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { workspace_id, name, parent_id } = body;

    if (!workspace_id || !name) {
      return NextResponse.json({ error: "workspace_id and name required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("media_folders")
      .insert({ workspace_id, name, parent_id: parent_id || null })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, folder: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
