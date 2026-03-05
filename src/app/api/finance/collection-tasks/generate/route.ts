import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// Priority computation helper
function computePriority(overdayDays: number, uncollected: number, daysUntilDue: number | null): string {
    if (overdayDays > 30 || uncollected >= 5000) return 'P0';
    if (overdayDays >= 7 || (uncollected >= 1000 && uncollected < 5000)) return 'P1';
    if (overdayDays >= 1 || (daysUntilDue !== null && daysUntilDue <= 3)) return 'P1';
    return 'P2';
}

export async function POST() {
    try {
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

        // 1. Fetch all unpaid receivables (overdue OR due this month)
        const { data: receivables, error: recError } = await supabase
            .from('company_receivables')
            .select(`
                id,
                customer_id,
                payment_due_date,
                amount_payable_period,
                amount_paid_period
            `)
            .or(`payment_due_date.lt.${todayStr},and(payment_due_date.gte.${monthStart},payment_due_date.lte.${monthEnd})`);

        if (recError) {
            return NextResponse.json({ error: recError.message }, { status: 500 });
        }

        // Filter to only unpaid
        const unpaidReceivables = (receivables || []).filter((r: any) => {
            const paid = Number(r.amount_paid_period || 0);
            const payable = Number(r.amount_payable_period || 0);
            return payable > 0 && paid < payable;
        });

        if (unpaidReceivables.length === 0) {
            return NextResponse.json({ created: 0, message: '没有需要生成的催款任务' });
        }

        // 2. Get existing open tasks for these receivables (prevent duplicates)
        const receivableIds = unpaidReceivables.map((r: any) => r.id);
        const { data: existingTasks } = await supabase
            .from('collection_tasks')
            .select('receivable_id')
            .in('receivable_id', receivableIds)
            .in('status', ['open', 'in_progress', 'promised']);

        const existingReceivableIds = new Set((existingTasks || []).map((t: any) => t.receivable_id));

        // 3. Build new tasks to insert
        const toInsert = [];
        for (const rec of unpaidReceivables) {
            if (existingReceivableIds.has(rec.id)) continue; // already has open task

            const paid = Number(rec.amount_paid_period || 0);
            const payable = Number(rec.amount_payable_period || 0);
            const uncollected = payable - paid;
            const dueDate = rec.payment_due_date;
            const isOverdue = dueDate < monthStart;
            const overdueDays = isOverdue
                ? Math.floor((today.getTime() - new Date(dueDate).getTime()) / 86400000)
                : 0;
            const daysUntilDue = !isOverdue
                ? Math.ceil((new Date(dueDate).getTime() - today.getTime()) / 86400000)
                : null;

            const priority = computePriority(overdueDays, uncollected, daysUntilDue);

            toInsert.push({
                customer_id: rec.customer_id,
                receivable_id: rec.id,
                priority,
                status: 'open',
                target_amount: uncollected,
                due_date: dueDate,
            });
        }

        if (toInsert.length === 0) {
            return NextResponse.json({ created: 0, message: '所有应收账款已有未完成的催款任务' });
        }

        const { error: insertError } = await supabase
            .from('collection_tasks')
            .insert(toInsert);

        if (insertError) {
            console.error('[collection-tasks/generate] insert error:', insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ created: toInsert.length, message: `成功生成 ${toInsert.length} 条催款任务` });
    } catch (err: any) {
        console.error('[collection-tasks/generate] unexpected error:', err);
        return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
    }
}
