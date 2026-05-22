import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

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

    // Save to local filesystem
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Fetch workspace name
    const { data: workspaceData } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single();
    const workspaceName = workspaceData ? sanitize(workspaceData.name) : workspaceId;

    // Determine subfolder path
    let subFolderPath = '';
    
    // If it belongs to a deal, fetch the deal name
    if (dealId && dealId !== 'null') {
      const { data: dealData } = await supabase.from('deals').select('title').eq('id', dealId).single();
      if (dealData) {
        subFolderPath = sanitize(dealData.title);
      }
    } 
    // Otherwise if it's placed in a specific folder, fetch the folder hierarchy (for now just the folder name)
    else if (targetFolderId && targetFolderId !== 'null') {
      const { data: folderData } = await supabase.from('media_folders').select('name').eq('id', targetFolderId).single();
      if (folderData) {
        subFolderPath = sanitize(folderData.name);
      }
    } else if (autoFolder) {
      subFolderPath = sanitize(autoFolder);
    }

    const uniqueId = uuidv4();
    const extension = file.name.split('.').pop() || 'bin';
    const sanitizedOriginalName = sanitize(file.name.replace(`.${extension}`, ''));
    const savedName = `${sanitizedOriginalName}_${uniqueId.substring(0, 8)}.${extension}`;
    
    // Construct local path: public/uploads/[Workspace Name]/[Subfolder]/[savedName]
    const uploadDir = join(process.cwd(), "public", "uploads", workspaceName, subFolderPath);
    await mkdir(uploadDir, { recursive: true });
    
    const filePath = join(uploadDir, savedName);
    await writeFile(filePath, buffer);

    const relativePath = `/uploads/${workspaceName}${subFolderPath ? `/${subFolderPath}` : ''}/${savedName}`;

    // Insert into DB
    const insertData: any = {
      workspace_id: workspaceId,
      name: file.name,
      mime_type: file.type,
      file_size: file.size,
      local_path: relativePath,
    };
    if (targetFolderId && targetFolderId !== 'null') insertData.folder_id = targetFolderId;
    if (dealId && dealId !== 'null') insertData.deal_id = dealId;

    const { data: dbFile, error: dbErr } = await supabase
      .from("media_files")
      .insert(insertData)
      .select()
      .single();
    
    if (dbErr) throw dbErr;

    return NextResponse.json({ success: true, file: dbFile });

  } catch (error: any) {
    console.error("[upload error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
