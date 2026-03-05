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
        // User requested: "平台刚开 客户都是直接导入进去的 所以本月新增用户是0" 
        // So we hardcode this to 0
        const thisMonthCount = 0;

        // 3. Get last month's customers
        const lastMonthCount = 0; // Also 0 for consistency

        // The change compared to last month
        const monthlyChange = 0;

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
