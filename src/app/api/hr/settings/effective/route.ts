import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const effectiveDate = searchParams.get('effectiveDate') || new Date().toISOString().split('T')[0];

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    let { data: rules, error } = await admin
      .from('hr_statutory_rules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .lte('effective_from', effectiveDate)
      .eq('is_active', true)
      .order('effective_from', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Seed CA-compliant default statutory rules if none exist yet for this workspace
    if (!rules || rules.length === 0) {
      const defaultRules = [
        {
          workspace_id: workspaceId,
          rule_type: 'PF',
          rule_name: 'Provident Fund (PF Standard)',
          employee_rate: 12,
          employer_rate: 12,
          wage_ceiling: 15000,
          min_threshold: 0,
          effective_from: '2026-01-01',
          is_active: true,
        },
        {
          workspace_id: workspaceId,
          rule_type: 'ESI',
          rule_name: 'Employee State Insurance (ESI)',
          employee_rate: 0.75,
          employer_rate: 3.25,
          wage_ceiling: 21000,
          min_threshold: 0,
          effective_from: '2026-01-01',
          is_active: true,
        },
        {
          workspace_id: workspaceId,
          rule_type: 'PT',
          rule_name: 'Professional Tax (PT Slab)',
          employee_rate: 0,
          employer_rate: 0,
          wage_ceiling: 0,
          min_threshold: 15000,
          effective_from: '2026-01-01',
          is_active: true,
        },
        {
          workspace_id: workspaceId,
          rule_type: 'TDS',
          rule_name: 'Income Tax TDS (New Regime)',
          employee_rate: 0,
          employer_rate: 0,
          wage_ceiling: 700000,
          min_threshold: 300000,
          effective_from: '2026-01-01',
          is_active: true,
        },
      ];

      const { data: seeded } = await admin
        .from('hr_statutory_rules')
        .insert(defaultRules)
        .select('*');

      rules = seeded || [];
    }

    return NextResponse.json({ rules: rules || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workspaceId, ruleType, ruleName, employeeRate, employerRate, wageCeiling, minThreshold, effectiveFrom } = body;

    if (!workspaceId || !ruleType || !ruleName) {
      return NextResponse.json({ error: 'workspaceId, ruleType, and ruleName are required' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: ruleRow, error } = await admin
      .from('hr_statutory_rules')
      .insert({
        workspace_id: workspaceId,
        rule_type: ruleType,
        rule_name: ruleName,
        employee_rate: employeeRate ? Number(employeeRate) : 0,
        employer_rate: employerRate ? Number(employerRate) : 0,
        wage_ceiling: wageCeiling ? Number(wageCeiling) : 0,
        min_threshold: minThreshold ? Number(minThreshold) : 0,
        effective_from: effectiveFrom || new Date().toISOString().split('T')[0],
        is_active: true,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rule: ruleRow });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
