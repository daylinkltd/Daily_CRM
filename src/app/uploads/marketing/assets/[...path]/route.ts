import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  avif: 'image/avif',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse('Asset not found', { status: 404 });
    }

    // Sanitize path segments to prevent directory traversal
    const safeSegments = pathSegments.map((s) => s.replace(/[^a-zA-Z0-9._-]/g, ''));
    const filePath = join(process.cwd(), 'public', 'uploads', 'marketing', 'assets', ...safeSegments);

    if (!existsSync(filePath)) {
      return new NextResponse('Asset not found', { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    const ext = safeSegments[safeSegments.length - 1].split('.').pop()?.toLowerCase() || 'png';
    const contentType = MIME_MAP[ext] || 'image/png';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    console.error('[AssetServeRoute] Error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
