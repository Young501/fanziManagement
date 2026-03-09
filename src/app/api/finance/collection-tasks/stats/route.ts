import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

export async function GET() {
    try {
        const supabase = createAdminClient();
        const today = new Date();

        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthStart = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;

        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const monthEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

        const { data: tasks, error } = await supabase
            .from('collection_tasks_view')
            .select('uncollected_amount, is_overdue, receivable_due_date')
            .gt('uncollected_amount', 0);

        if (error) {
            console.error('[collection-tasks/stats] error:', error);
            return noStoreJson({ error: error.message }, 500);
        }

        let overdue_count = 0;
        let due_this_month_count = 0;
        let total_uncollected = 0;

        for (const task of (tasks || [])) {
            const uncollected = Number(task.uncollected_amount || 0);
            total_uncollected += uncollected;

            if (task.is_overdue) {
                overdue_count++;
            } else if (task.receivable_due_date >= monthStart && task.receivable_due_date <= monthEnd) {
                due_this_month_count++;
            }
        }

        return noStoreJson({ overdue_count, due_this_month_count, total_uncollected });
    } catch (err: any) {
        console.error('[collection-tasks/stats] unexpected error:', err);
        return noStoreJson({ error: err?.message ?? 'Internal server error' }, 500);
    }
}
