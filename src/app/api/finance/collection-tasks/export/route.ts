import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthStart = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const monthEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

        // Fetch tasks: uncollected_amount > 0 AND (is_overdue OR is due this month)
        const query = supabase
            .from('collection_tasks_view')
            .select('*')
            .gt('uncollected_amount', 0)
            .or(`is_overdue.eq.true,and(is_overdue.eq.false,receivable_due_date.gte.${monthStart},receivable_due_date.lte.${monthEnd})`)
            .order('is_overdue', { ascending: false }) // overdue first
            .order('receivable_due_date', { ascending: true });

        const { data, error } = await query;

        if (error) {
            console.error('[export] error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: data || [] });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
    }
}
