import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST: Record Raw Material Purchase GRN (Supplier Delivery into Store Room)
export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const body = await request.json();

    const {
      raw_material_id,
      quantity,
      unit_cost,
      supplier_name = 'General Supplier',
      invoice_no = `INV-${Date.now().toString().slice(-6)}`,
      destination_location = 'STORE_ROOM',
      notes,
      workspace_id,
    } = body;

    if (!raw_material_id || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Valid raw_material_id and quantity are required' },
        { status: 400 }
      );
    }

    const total_cost = Number(quantity) * Number(unit_cost || 0);

    // 1. Update/Upsert stock balance for destination_location
    const { data: existingBal } = await admin
      .from('kitchen_stock_balances')
      .select('*')
      .eq('raw_material_id', raw_material_id)
      .eq('location', destination_location)
      .single();

    if (existingBal) {
      const newStock = Number(existingBal.current_stock) + Number(quantity);
      await admin
        .from('kitchen_stock_balances')
        .update({
          current_stock: newStock,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', existingBal.id);
    } else {
      await admin.from('kitchen_stock_balances').insert({
        raw_material_id,
        location: destination_location,
        current_stock: quantity,
        workspace_id,
      });
    }

    // 2. Update Weighted Average Cost per unit in raw_material master
    if (unit_cost && unit_cost > 0) {
      await admin
        .from('kitchen_raw_materials')
        .update({
          cost_per_unit: unit_cost,
          updated_at: new Date().toISOString(),
        })
        .eq('id', raw_material_id);
    }

    // 3. Insert audit stock movement
    await admin.from('kitchen_stock_movements').insert({
      raw_material_id,
      movement_type: 'INWARD_GRN',
      source_location: supplier_name,
      destination_location,
      quantity,
      unit_cost,
      total_cost,
      reference_id: invoice_no,
      notes: notes || `Supplier Inward GRN - Inv #${invoice_no}`,
      workspace_id,
    });

    return NextResponse.json({ success: true, message: 'Stock Inward GRN recorded successfully' });
  } catch (error: any) {
    console.error('Error recording raw GRN:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record stock inward GRN' },
      { status: 500 }
    );
  }
}
