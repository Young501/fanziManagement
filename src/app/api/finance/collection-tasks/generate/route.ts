import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getRemainingReceivableAmount } from '@/lib/finance-status';

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

function computePriority(overdayDays: number, uncollected: number, daysUntilDue: number | null): string {
    if (overdayDays > 30 || uncollected >= 5000) return 'P0';
    if (overdayDays >= 7 || (uncollected >= 1000 && uncollected < 5000)) return 'P1';
    if (overdayDays >= 1 || (daysUntilDue !== null && daysUntilDue <= 3)) return 'P1';
    return 'P2';
}

export async function POST() {
    try {
        const supabaseAuth = await createServerClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user) return noStoreJson({ error: '未授权，请先登录' }, 401);

        const supabase = createAdminClient();
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthStart = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;

        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const monthEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

        const { data: receivables, error: recError } = await supabase
            .from('company_receivables')
            .select(`
                id,
                customer_id,
                payment_due_date,
                amount_payable_period,
                amount_paid_period,
                customers!inner (
                    customer_status
                )
            `)
            .or(`payment_due_date.lt.${todayStr},and(payment_due_date.gte.${monthStart},payment_due_date.lte.${monthEnd})`)
            .neq('customers.customer_status', '流失');

        if (recError) {
            return noStoreJson({ error: recError.message }, 500);
        }

        const unpaidReceivables = (receivables || []).filter((r: any) => {
            const paid = Number(r.amount_paid_period || 0);
            const payable = Number(r.amount_payable_period || 0);
            return getRemainingReceivableAmount(payable, paid) > 0.01;
        });

        if (unpaidReceivables.length === 0) {
            return noStoreJson({ created: 0, message: 'No receivables require new tasks' });
        }

        const receivableIds = unpaidReceivables.map((r: any) => r.id);
        const { data: allExistingTasks } = await supabase
            .from('collection_tasks')
            .select('id, receivable_id, status')
            .in('receivable_id', receivableIds);

        const activeTaskReceivableIds = new Set(
            (allExistingTasks || [])
                .filter((t: any) => ['open', 'in_progress', 'promised'].includes(t.status))
                .map((t: any) => t.receivable_id)
        );

        const completedTaskMap = new Map();
        const cancelledTaskReceivableIds = new Set<string>();
        (allExistingTasks || []).forEach((t: any) => {
            if (t.status === 'completed') {
                completedTaskMap.set(t.receivable_id, t.id);
            }
            if (t.status === 'cancelled') {
                cancelledTaskReceivableIds.add(t.receivable_id);
            }
        });

        const toInsert = [];
        const toReopen: any[] = [];
        let skippedActive = 0;
        let skippedCancelled = 0;
        
        for (const rec of unpaidReceivables) {
            if (activeTaskReceivableIds.has(rec.id)) {
                skippedActive += 1;
                continue;
            }
            if (cancelledTaskReceivableIds.has(rec.id)) {
                skippedCancelled += 1;
                continue;
            }

            const paid = Number(rec.amount_paid_period || 0);
            const payable = Number(rec.amount_payable_period || 0);
            const uncollected = getRemainingReceivableAmount(payable, paid);
            const dueDate = rec.payment_due_date;
            if (!dueDate || uncollected <= 0.01) continue;
            const isOverdue = dueDate < monthStart;
            const overdueDays = isOverdue
                ? Math.floor((today.getTime() - new Date(dueDate).getTime()) / 86400000)
                : 0;
            const daysUntilDue = !isOverdue
                ? Math.ceil((new Date(dueDate).getTime() - today.getTime()) / 86400000)
                : null;

            const priority = computePriority(overdueDays, uncollected, daysUntilDue);

            if (completedTaskMap.has(rec.id)) {
                toReopen.push({
                    id: completedTaskMap.get(rec.id),
                    customer_id: rec.customer_id,
                    receivable_id: rec.id,
                    priority,
                    status: 'open',
                    target_amount: uncollected,
                    due_date: dueDate,
                });
            } else {
                toInsert.push({
                    customer_id: rec.customer_id,
                    receivable_id: rec.id,
                    priority,
                    status: 'open',
                    target_amount: uncollected,
                    due_date: dueDate,
                });
            }
        }

        if (toInsert.length === 0 && toReopen.length === 0) {
            return noStoreJson({
                created: 0,
                reopened: 0,
                skipped_active: skippedActive,
                skipped_cancelled: skippedCancelled,
                message: 'All unpaid receivables already have active tasks or were intentionally skipped',
            });
        }

        if (toInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('collection_tasks')
                .insert(toInsert);

            if (insertError) {
                console.error('[collection-tasks/generate] insert error:', insertError);
                return noStoreJson({ error: insertError.message }, 500);
            }
        }

        if (toReopen.length > 0) {
            const { error: reopenError } = await supabase
                .from('collection_tasks')
                .upsert(toReopen);

            if (reopenError) {
                console.error('[collection-tasks/generate] reopen error:', reopenError);
                return noStoreJson({ error: reopenError.message }, 500);
            }
        }

        return noStoreJson({
            created: toInsert.length,
            reopened: toReopen.length,
            skipped_active: skippedActive,
            skipped_cancelled: skippedCancelled,
            message: `Generated ${toInsert.length} tasks, reopened ${toReopen.length} tasks, skipped ${skippedActive} active and ${skippedCancelled} cancelled tasks`,
        });
    } catch (err: any) {
        console.error('[collection-tasks/generate] unexpected error:', err);
        return noStoreJson({ error: err?.message ?? 'Internal server error' }, 500);
    }
}
