import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST: Transfer raw stock from Store Room to specific Kitchen Station (e.g. Tandoor / Main Kitchen)
export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const body = await request.json();

    const {
      raw_material_id,
      from_location = 'STORE_ROOM',
      to_location = 'MAIN_KITCHEN',
      quantity,
      notes,
      workspace_id,
    } = body;

    if (!raw_material_id || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Valid raw_material_id and transfer quantity are required' },
        { status: 400 }
      );
    }

    if (from_location === to_location) {
      return NextResponse.json(
        { error: 'Source and destination locations must be different' },
        { status: 400 }
      );
    }

    // 1. Check source location stock balance
    const { data: sourceBal } = await admin
      .from('kitchen_stock_balances')
      .select('*')
      .eq('raw_material_id', raw_material_id)
      .eq('location', from_location)
      .single();

    const currentSourceStock = Number(sourceBal?.current_stock || 0);
    if (currentSourceStock < Number(quantity)) {
      return NextResponse.json(
        {
          error: `Insufficient stock in ${from_location}. Available: ${currentSourceStock}, Requested: ${quantity}`,
        },
        { status: 400 }
      );
    }

    // 2. Deduct from Source Location
    await admin
      .from('kitchen_stock_balances')
      .update({
        current_stock: currentSourceStock - Number(quantity),
        last_updated_at: new Date().toISOString(),
      })
      .eq('id', sourceBal.id);

    // 3. Add to Destination Location
    const { data: destBal } = await admin
      .from('kitchen_stock_balances')
      .select('*')
      .eq('raw_material_id', raw_material_id)
      .eq('location', to_location)
      .single();

    if (destBal) {
      await admin
        .from('kitchen_stock_balances')
        .update({
          current_stock: Number(destBal.current_stock) + Number(quantity),
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', destBal.id);
    } else {
      await admin.from('kitchen_stock_balances').insert({
        raw_material_id,
        location: to_location,
        current_stock: quantity,
        workspace_id,
      });
    }

    // 4. Record Movement Log
    const transferRef = `TRF-${Date.now().toString().slice(-6)}`;
    await admin.from('kitchen_stock_movements').insert({
      raw_material_id,
      movement_type: 'STATION_TRANSFER',
      source_location: from_location,
      destination_location: to_location,
      quantity,
      reference_id: transferRef,
      notes: notes || `Internal transfer from ${from_location} to ${to_location}`,
      workspace_id,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully transferred ${quantity} from ${from_location} to ${to_location}`,
    });
  } catch (error: any) {
    console.error('Error processing station transfer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process station stock transfer' },
      { status: 500 }
    );
  }
}
