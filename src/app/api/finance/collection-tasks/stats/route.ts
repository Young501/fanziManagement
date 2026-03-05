import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function GET() {
    try {
        const supabase = createAdminClient();
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        // Month boundaries
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthStart = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;

        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const monthEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

        // Fetch all open/in_progress/promised collection tasks with their receivable
        const { data: tasks, error } = await supabase
            .from('collection_tasks')
            .select(`
                id,
                status,
                due_date,
                receivable_id,
                company_receivables!inner (
                    payment_due_date,
                    amount_payable_period,
                    amount_paid_period
                )
            `)
            .in('status', ['open', 'in_progress', 'promised']);

        if (error) {
            console.error('[collection-tasks/stats] error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        let overdue_count = 0;
        let due_this_month_count = 0;
        let total_uncollected = 0;

        for (const task of (tasks || [])) {
            const rec = (task as any).company_receivables;
            if (!rec) continue;

            const paid = Number(rec.amount_paid_period || 0);
            const payable = Number(rec.amount_payable_period || 0);
            const uncollected = payable - paid;

            if (uncollected <= 0) continue;

            total_uncollected += uncollected;

            const dueDate = rec.payment_due_date;
            if (!dueDate) continue;

            if (dueDate < monthStart) {
                overdue_count++;
            } else if (dueDate >= monthStart && dueDate <= monthEnd) {
                due_this_month_count++;
            }
        }

        return NextResponse.json({ overdue_count, due_this_month_count, total_uncollected });
    } catch (err: any) {
        console.error('[collection-tasks/stats] unexpected error:', err);
        return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
    }
}
