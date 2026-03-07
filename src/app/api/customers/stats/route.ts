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

        // 1. Get total customers
        const { count: totalCustomers, error: totalError } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });

        if (totalError) throw totalError;

        // 2. Get current month's and last month's customers dynamically
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        // 0th day of current month gets last day of previous month
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();

        const { count: thisMonthCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', thisMonthStart);

        const { count: lastMonthCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', lastMonthStart)
            .lte('created_at', lastMonthEnd);

        // The change compared to last month
        const monthlyChange = (thisMonthCount || 0) - (lastMonthCount || 0);

        return NextResponse.json({
            totalCustomers: totalCustomers || 0,
            thisMonthCount: thisMonthCount || 0,
            lastMonthCount: lastMonthCount || 0,
            monthlyChange,
        });
    } catch (err: any) {
        console.error('[customers stats API] error:', err);
        return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
    }
}
