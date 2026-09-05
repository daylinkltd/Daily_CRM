import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');
    const category = searchParams.get('category');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    let query = supabase
      .from('marketing_brand_assets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: assets, error } = await query;

    if (error) {
      console.warn('[BrandAssetsAPI] DB Fetch warning (table pending migration):', error.message);
    }

    const baseAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://dailybuz.com';
    const cleanBase = baseAppUrl.replace(/\/$/, '');

    const normalizedAssets = ((assets || []) as any[]).map((a) => ({
      ...a,
      public_url: a.public_url?.startsWith('http')
        ? a.public_url
        : `${cleanBase}${a.public_url?.startsWith('/') ? a.public_url : `/${a.public_url || ''}`}`,
    }));

    return NextResponse.json({
      success: true,
      assets: normalizedAssets,
    });
  } catch (err: any) {
    console.error('[BrandAssetsAPI] GET Error:', err);
    return NextResponse.json({ success: true, assets: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const workspaceId = formData.get('workspace_id') as string | null;
    const name = (formData.get('name') as string) || (file ? file.name : 'Asset');
    const category = (formData.get('category') as string) || 'LOGOS';
    const subCategory = (formData.get('sub_category') as string) || '';
    const description = (formData.get('description') as string) || '';

    if (!file || !workspaceId) {
      return NextResponse.json({ error: 'File and workspace_id are required' }, { status: 400 });
    }

    // Validate MIME type
    const validMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!validMimes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: PNG, JPEG, WEBP, SVG.` },
        { status: 400 }
      );
    }

    // Max 20MB limit
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 20MB maximum limit' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileSizeBytes = file.size;

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const sanitizedExt = fileExt.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'png';
    const assetId = uuidv4();
    const fileName = `${assetId}.${sanitizedExt}`;

    // Tenant-isolated storage directory under public/uploads/marketing/assets/<workspace_id>/
    const safeWorkspace = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '');
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'marketing', 'assets', safeWorkspace);
    await mkdir(uploadsDir, { recursive: true });

    const diskPath = join(uploadsDir, fileName);
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    let baseAppUrl = 'https://dailybuz.com';
    if (process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || process.env.APP_URL) {
      baseAppUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || process.env.APP_URL)!.replace(/\/$/, '');
    } else if (host) {
      baseAppUrl = `${proto}://${host}`;
    }
    const cleanBase = baseAppUrl.replace(/\/$/, '');
    const relativeUrl = `/uploads/marketing/assets/${safeWorkspace}/${fileName}`;
    const publicUrl = `${cleanBase}${relativeUrl}`;

    let insertedAsset: any = null;

    try {
      const { data: asset, error: dbError } = await supabase
        .from('marketing_brand_assets')
        .insert({
          id: assetId,
          workspace_id: workspaceId,
          name: name.trim(),
          category,
          sub_category: subCategory.trim() || null,
          description: description.trim() || null,
          storage_path: diskPath,
          public_url: publicUrl,
          mime_type: file.type || 'image/png',
          file_size_bytes: fileSizeBytes,
          created_by: user.id,
        })
        .select('*')
        .single();

      if (dbError) {
        console.warn('[BrandAssetsAPI] DB Insert warning (table pending migration):', dbError.message);
        insertedAsset = {
          id: assetId,
          workspace_id: workspaceId,
          name: name.trim(),
          category,
          sub_category: subCategory.trim() || null,
          description: description.trim() || null,
          storage_path: diskPath,
          public_url: publicUrl,
          mime_type: file.type || 'image/png',
          file_size_bytes: fileSizeBytes,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        insertedAsset = asset;
      }
    } catch (e: any) {
      console.warn('[BrandAssetsAPI] Non-blocking DB write fallback:', e.message);
      insertedAsset = {
        id: assetId,
        workspace_id: workspaceId,
        name: name.trim(),
        category,
        sub_category: subCategory.trim() || null,
        description: description.trim() || null,
        storage_path: diskPath,
        public_url: publicUrl,
        mime_type: file.type || 'image/png',
        file_size_bytes: fileSizeBytes,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      asset: insertedAsset,
    });
  } catch (err: any) {
    console.error('[BrandAssetsAPI] POST Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to upload brand asset' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, workspace_id, name, category, sub_category, description } = body;

    if (!id || !workspace_id) {
      return NextResponse.json({ error: 'id and workspace_id are required' }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) updates.name = name.trim();
    if (category !== undefined) updates.category = category;
    if (sub_category !== undefined) updates.sub_category = sub_category.trim() || null;
    if (description !== undefined) updates.description = description.trim() || null;

    const { data: updated, error } = await supabase
      .from('marketing_brand_assets')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspace_id)
      .select('*')
      .single();

    if (error) {
      console.error('[BrandAssetsAPI] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      asset: updated,
    });
  } catch (err: any) {
    console.error('[BrandAssetsAPI] PATCH Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update brand asset' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const workspaceId = searchParams.get('workspace_id');

    if (!id || !workspaceId) {
      return NextResponse.json({ error: 'id and workspace_id are required' }, { status: 400 });
    }

    // Find the asset to get storage_path
    const { data: asset } = await supabase
      .from('marketing_brand_assets')
      .select('storage_path')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (asset?.storage_path) {
      try {
        await unlink(asset.storage_path);
      } catch (fsErr) {
        console.warn('[BrandAssetsAPI] File removal non-fatal warning:', fsErr);
      }
    }

    const { error } = await supabase
      .from('marketing_brand_assets')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('[BrandAssetsAPI] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_id: id,
    });
  } catch (err: any) {
    console.error('[BrandAssetsAPI] DELETE Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete brand asset' }, { status: 500 });
  }
}
