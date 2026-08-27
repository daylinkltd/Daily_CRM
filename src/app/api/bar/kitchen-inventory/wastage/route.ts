import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST: Log Raw Material Prep Spoilage & Wastage Loss
export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const body = await request.json();

    const {
      raw_material_id,
      location = 'MAIN_KITCHEN',
      quantity_lost,
      reason = 'SPOILED',
      reported_by_name = 'Head Chef',
      notes,
      workspace_id,
    } = body;

    if (!raw_material_id || !quantity_lost || quantity_lost <= 0) {
      return NextResponse.json(
        { error: 'Valid raw_material_id and quantity_lost are required' },
        { status: 400 }
      );
    }

    // 1. Fetch material cost per unit & unit of measure
    const { data: material } = await admin
      .from('kitchen_raw_materials')
      .select('*')
      .eq('id', raw_material_id)
      .single();

    if (!material) {
      return NextResponse.json({ error: 'Raw material not found' }, { status: 404 });
    }

    const unitCost = Number(material.cost_per_unit || 0);
    const cost_impact = unitCost * Number(quantity_lost);

    // 2. Check & deduct stock from location
    const { data: stockBal } = await admin
      .from('kitchen_stock_balances')
      .select('*')
      .eq('raw_material_id', raw_material_id)
      .eq('location', location)
      .single();

    const currentStock = Number(stockBal?.current_stock || 0);
    const newStock = Math.max(0, currentStock - Number(quantity_lost));

    if (stockBal) {
      await admin
        .from('kitchen_stock_balances')
        .update({
          current_stock: newStock,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', stockBal.id);
    }

    // 3. Create Wastage Log record
    const { data: wastageLog, error: wError } = await admin
      .from('kitchen_wastage_logs')
      .insert({
        raw_material_id,
        location,
        quantity_lost,
        unit_of_measure: material.unit_of_measure,
        reason,
        cost_impact,
        reported_by_name,
        notes: notes || `Spoilage loss reported in ${location}`,
        workspace_id,
      })
      .select()
      .single();

    if (wError) throw wError;

    // 4. Record audit stock movement
    await admin.from('kitchen_stock_movements').insert({
      raw_material_id,
      movement_type: 'SPOILED_WASTAGE',
      source_location: location,
      destination_location: 'WASTAGE_DISPOSAL',
      quantity: quantity_lost,
      unit_cost: unitCost,
      total_cost: cost_impact,
      reference_id: `WASTE-${Date.now().toString().slice(-6)}`,
      notes: `Reason: ${reason}. Reported by ${reported_by_name}`,
      workspace_id,
    });

    return NextResponse.json({
      success: true,
      wastageLog,
      message: `Wastage log recorded for ${material.name} (Cost impact: ₹${cost_impact.toFixed(2)})`,
    });
  } catch (error: any) {
    console.error('Error logging kitchen wastage:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log kitchen wastage' },
      { status: 500 }
    );
  }
}
