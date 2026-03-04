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

        // 2. Get current month's customers
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { count: thisMonthCount, error: thisMonthError } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfThisMonth);

        if (thisMonthError) throw thisMonthError;

        // 3. Get last month's customers
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();

        const { count: lastMonthCount, error: lastMonthError } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfLastMonth)
            .lte('created_at', endOfLastMonth);

        if (lastMonthError) throw lastMonthError;

        // The change compared to last month
        // "较上月增加/减少客户数量" Usually means:
        // Option A: Net new customers this month minus net new customers last month.
        // Let's compute "(thisMonthCount - lastMonthCount)"
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
