import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET: Fetch all kitchen raw materials, stock balances per location, and summary stats
export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = admin
      .from('kitchen_raw_materials')
      .select('*')
      .order('name', { ascending: true });

    if (category && category !== 'ALL') {
      query = query.eq('category', category);
    }

    const { data: materials, error: matError } = await query;
    if (matError) throw matError;

    // Fetch all balances
    const { data: balances, error: balError } = await admin
      .from('kitchen_stock_balances')
      .select('*');
    if (balError) throw balError;

    // Fetch recent movements
    const { data: movements } = await admin
      .from('kitchen_stock_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    // Combine material with stock totals
    const materialMap = (materials || []).map((mat) => {
      const matBalances = (balances || []).filter((b) => b.raw_material_id === mat.id);
      const totalStock = matBalances.reduce((sum, b) => sum + Number(b.current_stock || 0), 0);
      
      let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'CRITICAL' = 'IN_STOCK';
      if (totalStock <= 0) {
        stockStatus = 'CRITICAL';
      } else if (totalStock <= (mat.reorder_threshold || 10)) {
        stockStatus = 'LOW_STOCK';
      }

      return {
        ...mat,
        totalStock,
        stockStatus,
        locationBalances: matBalances,
      };
    });

    // Calculate Summary Stats
    const totalItems = materialMap.length;
    const lowStockCount = materialMap.filter((m) => m.stockStatus === 'LOW_STOCK').length;
    const criticalCount = materialMap.filter((m) => m.stockStatus === 'CRITICAL').length;
    const totalValuation = materialMap.reduce(
      (acc, m) => acc + Number(m.totalStock) * Number(m.cost_per_unit || 0),
      0
    );

    // Fetch locations & suppliers masters
    const { data: dbLocations } = await admin.from('kitchen_locations').select('*');
    const { data: dbSuppliers } = await admin.from('kitchen_suppliers').select('*');

    return NextResponse.json({
      success: true,
      materials: materialMap,
      movements: movements || [],
      locations: dbLocations || [],
      suppliers: dbSuppliers || [],
      stats: {
        totalItems,
        lowStockCount,
        criticalCount,
        totalValuation,
      },
    });
  } catch (error: any) {
    console.error('Error fetching kitchen inventory:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch kitchen inventory' },
      { status: 500 }
    );
  }
}

// POST: Add new raw material ingredient or Master entries
export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const body = await request.json();

    // 1. Create Location Master
    if (body.action === 'CREATE_LOCATION') {
      const { name, code, description, workspace_id } = body;
      if (!name) return NextResponse.json({ error: 'Location name is required' }, { status: 400 });

      const { data: location, error } = await admin
        .from('kitchen_locations')
        .insert({ name, code: code || name.toUpperCase().replace(/\s+/g, '_'), description, workspace_id })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, location });
    }

    // 2. Create Supplier Master
    if (body.action === 'CREATE_SUPPLIER') {
      const { name, contact_person, phone, email, gstin, address, payment_terms, workspace_id } = body;
      if (!name) return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });

      const { data: supplier, error } = await admin
        .from('kitchen_suppliers')
        .insert({ name, contact_person, phone, email, gstin, address, payment_terms, workspace_id })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, supplier });
    }

    // 3. Create Raw Material ingredient
    const {
      name,
      category = 'GROCERY',
      unit_of_measure = 'KG',
      cost_per_unit = 0,
      reorder_threshold = 10,
      initial_stock = 0,
      ideal_yield_percentage = 100,
      preferred_supplier = '',
      shelf_life_days = 30,
      gst_rate = 5,
      hsn_code = '',
      initial_location = 'STORE_ROOM',
      workspace_id,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Material name is required' }, { status: 400 });
    }

    // 1. Create Raw Material record
    const { data: material, error: matErr } = await admin
      .from('kitchen_raw_materials')
      .insert({
        name,
        category,
        unit_of_measure,
        cost_per_unit,
        reorder_threshold,
        ideal_yield_percentage,
        preferred_supplier,
        shelf_life_days,
        gst_rate,
        hsn_code,
        workspace_id,
      })
      .select()
      .single();

    if (matErr) throw matErr;

    // 2. Create initial stock balance if initial_stock > 0
    if (initial_stock > 0 && material) {
      const location = initial_location || 'STORE_ROOM';
      await admin.from('kitchen_stock_balances').insert({
        raw_material_id: material.id,
        location,
        current_stock: initial_stock,
        workspace_id,
      });

      // Record initial inward movement
      await admin.from('kitchen_stock_movements').insert({
        raw_material_id: material.id,
        movement_type: 'INWARD_GRN',
        source_location: 'INITIAL_SETUP',
        destination_location: location,
        quantity: initial_stock,
        unit_cost: cost_per_unit,
        total_cost: initial_stock * cost_per_unit,
        notes: 'Initial Stock Onboarding',
        workspace_id,
      });
    }

    return NextResponse.json({ success: true, material });
  } catch (error: any) {
    console.error('Error creating raw material:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create raw material' },
      { status: 500 }
    );
  }
}
