import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

function toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function toNullableString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    return s ? s : null;
}

function noStoreJson(body: unknown, status = 200) {
    return NextResponse.json(body, {
        status,
        headers: { 'Cache-Control': 'no-store' },
    });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) {
            return noStoreJson({ error: 'Missing receivable ID' }, 400);
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return noStoreJson({ error: 'Unauthorized' }, 401);
        }

        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin' && profile?.role !== 'manager') {
            return noStoreJson({ error: 'Forbidden: Admin or Manager role required' }, 403);
        }

        const body = await request.json();

        const adminSupabase = createAdminClient();

        const payload = {
            billing_fee_month: toNullableNumber(body.billing_fee_month),
            pay_cycle_months: toNullableNumber(body.pay_cycle_months),
            standard_price: toNullableNumber(body.standard_price),
            discount_gap: toNullableNumber(body.discount_gap),
            has_contract: body.has_contract === undefined ? null : Boolean(body.has_contract),
            contract_end_date: toNullableString(body.contract_end_date),
            amount_payable_period: toNullableNumber(body.amount_payable_period),
            payment_due_date: toNullableString(body.payment_due_date),
            note: toNullableString(body.note),
        };

        const { data, error } = await adminSupabase
            .from('company_receivables')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return noStoreJson({ error: error.message }, 500);
        }

        return noStoreJson({ data });
    } catch (err: any) {
        return noStoreJson({ error: err?.message || 'Internal error' }, 500);
    }
}
