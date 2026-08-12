import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { calculateReceivableStatus, getRemainingReceivableAmount } from '@/lib/finance-status';

const ACTIVE_COLLECTION_STATUSES = ['open', 'in_progress', 'promised'];
const MAX_ROWS = 5000;

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

function noStoreJson(body: unknown, status = 200) {
    return NextResponse.json(body, {
        status,
        headers: { 'Cache-Control': 'no-store' },
    });
}

async function getRole() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    return profile?.role || null;
}

function canReconcile(role: string | null) {
    const normalized = role?.toLowerCase();
    return normalized === 'admin' || normalized === 'manager';
}

function parseLimit(value: string | null) {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return MAX_ROWS;
    return Math.min(parsed, MAX_ROWS);
}

async function reconcile(request: NextRequest, apply: boolean) {
    const role = await getRole();
    if (!canReconcile(role)) {
        return noStoreJson({ error: '权限不足，仅管理员或客户经理可校准财务状态' }, 403);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const receivableId = searchParams.get('receivable_id')?.trim();
    const customerId = searchParams.get('customer_id')?.trim();

    const supabase = createAdminClient();
    let query = supabase
        .from('company_receivables')
        .select('id, customer_id, status, amount_payable_period, amount_paid_period, payment_due_date')
        .order('payment_due_date', { ascending: false })
        .limit(limit);

    if (receivableId) query = query.eq('id', receivableId);
    if (customerId) query = query.eq('customer_id', customerId);

    const { data: rows, error } = await query;
    if (error) return noStoreJson({ error: error.message }, 500);

    const samples: Array<{
        id: string;
        customer_id: string | null;
        old_status: string | null;
        new_status: string;
        payable: number;
        paid: number;
    }> = [];
    const warnings: string[] = [];
    let updatedStatuses = 0;
    let completedTasks = 0;
    let retargetedTasks = 0;

    for (const row of rows || []) {
        const payable = Number(row.amount_payable_period || 0);
        const paid = Number(row.amount_paid_period || 0);
        const nextStatus = calculateReceivableStatus(paid, payable, row.payment_due_date);
        const currentStatus = String(row.status || '').toLowerCase();
        const remaining = getRemainingReceivableAmount(payable, paid);

        if (currentStatus !== nextStatus) {
            samples.push({
                id: row.id,
                customer_id: row.customer_id || null,
                old_status: row.status || null,
                new_status: nextStatus,
                payable,
                paid,
            });

            if (apply) {
                const { error: updateError } = await supabase
                    .from('company_receivables')
                    .update({ status: nextStatus })
                    .eq('id', row.id);

                if (updateError) {
                    warnings.push(`账单 ${row.id} 状态更新失败: ${updateError.message}`);
                } else {
                    updatedStatuses += 1;
                }
            }
        }

        if (!apply) continue;

        if (remaining <= 0.01) {
            const { data: changedTasks, error: taskError } = await supabase
                .from('collection_tasks')
                .update({ status: 'completed', target_amount: 0, due_date: row.payment_due_date || null })
                .eq('receivable_id', row.id)
                .in('status', ACTIVE_COLLECTION_STATUSES)
                .select('id');

            if (taskError) {
                warnings.push(`账单 ${row.id} 已付清，但催款任务关闭失败: ${taskError.message}`);
            } else {
                completedTasks += changedTasks?.length || 0;
            }
        } else {
            const { data: changedTasks, error: taskError } = await supabase
                .from('collection_tasks')
                .update({ target_amount: remaining, due_date: row.payment_due_date || null })
                .eq('receivable_id', row.id)
                .in('status', ACTIVE_COLLECTION_STATUSES)
                .select('id');

            if (taskError) {
                warnings.push(`账单 ${row.id} 催款金额同步失败: ${taskError.message}`);
            } else {
                retargetedTasks += changedTasks?.length || 0;
            }
        }
    }

    return noStoreJson({
        applied: apply,
        checked: rows?.length || 0,
        mismatched_statuses: samples.length,
        updated_statuses: updatedStatuses,
        completed_tasks: completedTasks,
        retargeted_tasks: retargetedTasks,
        samples: samples.slice(0, 50),
        warnings,
    });
}

export async function GET(request: NextRequest) {
    return reconcile(request, false);
}

export async function POST(request: NextRequest) {
    return reconcile(request, true);
}
