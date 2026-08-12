import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { calculateReceivableStatus, getRemainingReceivableAmount } from '@/lib/finance-status';

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

const RECEIVABLE_FIELDS = [
    'billing_fee_month',
    'pay_cycle_months',
    'standard_price',
    'discount_gap',
    'has_contract',
    'contract_end_date',
    'amount_payable_period',
    'payment_due_date',
    'note',
] as const;

const ACTIVE_COLLECTION_STATUSES = ['open', 'in_progress', 'promised'];

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
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role?.toLowerCase() !== 'admin' && profile?.role?.toLowerCase() !== 'manager') {
            return noStoreJson({ error: 'Forbidden: Admin or Manager role required' }, 403);
        }

        const body = await request.json();

        const adminSupabase = createAdminClient();

        const { data: existing, error: existingError } = await adminSupabase
            .from('company_receivables')
            .select('id, amount_payable_period, amount_paid_period, payment_due_date')
            .eq('id', id)
            .single();

        if (existingError || !existing) {
            return noStoreJson({ error: existingError?.message || 'Receivable not found' }, 404);
        }

        const payload: Record<string, unknown> = {};
        for (const field of RECEIVABLE_FIELDS) {
            if (!Object.prototype.hasOwnProperty.call(body, field)) continue;

            if (['billing_fee_month', 'pay_cycle_months', 'standard_price', 'discount_gap', 'amount_payable_period'].includes(field)) {
                payload[field] = toNullableNumber(body[field]);
            } else if (field === 'has_contract') {
                payload[field] = body.has_contract === undefined ? null : Boolean(body.has_contract);
            } else {
                payload[field] = toNullableString(body[field]);
            }
        }

        if (Object.keys(payload).length === 0) {
            return noStoreJson({ error: '没有可更新的账单字段' }, 400);
        }

        const nextPayable = payload.amount_payable_period !== undefined
            ? Number(payload.amount_payable_period || 0)
            : Number(existing.amount_payable_period || 0);
        const nextPaid = Number(existing.amount_paid_period || 0);
        const nextDueDate = payload.payment_due_date !== undefined
            ? String(payload.payment_due_date || '')
            : existing.payment_due_date;

        if (!Number.isFinite(nextPayable) || nextPayable < 0) {
            return noStoreJson({ error: '本期应收金额不正确' }, 400);
        }

        if (nextPayable < nextPaid - 0.01) {
            return noStoreJson({ error: `本期应收金额不能小于已收金额 ￥${nextPaid.toFixed(2)}` }, 400);
        }

        payload.status = calculateReceivableStatus(nextPaid, nextPayable, nextDueDate);

        const { data, error } = await adminSupabase
            .from('company_receivables')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return noStoreJson({ error: error.message }, 500);
        }

        const warnings: string[] = [];
        const remaining = getRemainingReceivableAmount(nextPayable, nextPaid);
        const taskUpdates: Record<string, unknown> = remaining <= 0.01
            ? { status: 'completed', target_amount: 0, due_date: nextDueDate || null }
            : { target_amount: remaining, due_date: nextDueDate || null };

        const { error: taskError } = await adminSupabase
            .from('collection_tasks')
            .update(taskUpdates)
            .eq('receivable_id', id)
            .in('status', ACTIVE_COLLECTION_STATUSES);

        if (taskError) {
            warnings.push(`账单已更新，但催款任务同步失败: ${taskError.message}`);
        }

        return noStoreJson({ data, warnings });
    } catch (err: any) {
        return noStoreJson({ error: err?.message || 'Internal error' }, 500);
    }
}
