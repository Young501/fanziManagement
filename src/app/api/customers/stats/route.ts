import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

        // 1. Get total customers (excluding churned)
        const { count: totalCustomers, error: totalError } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .neq('customer_status', '流失');

        if (totalError) throw totalError;

        // 2. Dates setup (use local time strings)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const thisMonthStartRaw = `${year}-${month}-01`;
        const thisMonthStart = thisMonthStartRaw < '2026-03-10' ? '2026-03-10' : thisMonthStartRaw;

        const lastDayThisMonth = new Date(year, now.getMonth() + 1, 0);
        const thisMonthEnd = `${year}-${month}-${String(lastDayThisMonth.getDate()).padStart(2, '0')}`;

        const lastMonthDate = new Date(year, now.getMonth() - 1, 1);
        const lastMonthY = lastMonthDate.getFullYear();
        const lastMonthM = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
        const lastMonthStartRaw = `${lastMonthY}-${lastMonthM}-01`;
        const lastMonthStart = lastMonthStartRaw < '2026-03-10' ? '2026-03-10' : lastMonthStartRaw;

        const lastDayLastMonth = new Date(year, now.getMonth(), 0);
        const lastMonthEnd = `${lastMonthY}-${lastMonthM}-${String(lastDayLastMonth.getDate()).padStart(2, '0')}`;

        // 3. Get New Customers
        const { count: thisMonthNew } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', thisMonthStart)
            .lte('created_at', thisMonthEnd)
            .neq('customer_status', '流失');

        const { count: lastMonthNew } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', lastMonthStart)
            .lte('created_at', lastMonthEnd)
            .neq('customer_status', '流失');

        // 4. Get Churned Customers from logs (use Raw start dates to get ALL churns in the month)
        const { count: thisMonthChurned } = await supabase
            .from('customer_churn_logs')
            .select('*', { count: 'exact', head: true })
            .gte('churn_date', thisMonthStartRaw)
            .lte('churn_date', thisMonthEnd);

        const { count: lastMonthChurned } = await supabase
            .from('customer_churn_logs')
            .select('*', { count: 'exact', head: true })
            .gte('churn_date', lastMonthStartRaw)
            .lte('churn_date', lastMonthEnd);

        // 5. Calculate net change
        // thisMonthCount = (Actual new this month) - (Actual churned this month)
        const thisMonthNet = (thisMonthNew || 0) - (thisMonthChurned || 0);
        const lastMonthNet = (lastMonthNew || 0) - (lastMonthChurned || 0);

        // monthlyChange is the difference in net performance
        const monthlyChange = thisMonthNet - lastMonthNet;

        return noStoreJson({
            totalCustomers: totalCustomers || 0,
            thisMonthCount: thisMonthNet,
            lastMonthCount: lastMonthNet,
            monthlyChange,
        });
    } catch (err: any) {
        console.error('[customers stats API] error:', err);
        return noStoreJson({ error: err?.message ?? 'Internal server error' }, 500);
    }
}
