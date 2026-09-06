import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const workspaceId = (formData.get("workspace_id") as string) || "default";

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const sizeMb = Number((file.size / (1024 * 1024)).toFixed(2));

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const isVideo = file.type.startsWith("video/") || ["mp4", "mov", "webm"].includes(fileExt);
    const mediaType = isVideo ? "video" : "image";
    const fileName = `${uuidv4()}.${fileExt}`;

    const uploadsDir = join(process.cwd(), "public", "uploads", "marketing");
    await mkdir(uploadsDir, { recursive: true });
    const filePath = join(uploadsDir, fileName);

    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/marketing/${fileName}`;

    // If Supabase workspace is valid UUID, register into marketing_media
    if (user && workspaceId && workspaceId.length > 20) {
      try {
        await supabase.from("marketing_media").insert({
          workspace_id: workspaceId,
          media_type: mediaType,
          url: publicUrl,
          dimensions: "1080x1080",
          file_size_mb: sizeMb,
          source: "UPLOADED",
          alt_text: file.name,
          created_by: user.id,
        });
      } catch (dbErr) {
        console.warn("[MarketingUpload] Non-blocking media registry error:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      media: {
        url: publicUrl,
        type: mediaType,
        source: "uploaded",
        fileSizeMb: sizeMb,
        altText: file.name,
      },
    });
  } catch (err: any) {
    console.error("[MarketingUpload] Upload failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to upload marketing media" },
      { status: 500 }
    );
  }
}
