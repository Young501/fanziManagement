import { createClient as createServerClient } from '@/utils/supabase/server';
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
        const supabaseAuth = await createServerClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user) return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });

        const supabaseAdmin = createAdminClient();
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month') || ''; // format: YYYY-MM

        if (!month) {
            return NextResponse.json({ error: '缺少month参数' }, { status: 400 });
        }

        const [year, mon] = month.split('-');
        const startDate = `${year}-${mon}-01`;
        const endYear = mon === '12' ? parseInt(year) + 1 : parseInt(year);
        const endMon = mon === '12' ? '01' : String(parseInt(mon) + 1).padStart(2, '0');
        const endDate = `${endYear}-${endMon}-01`;

        // Fetch revenue from payment_records
        const { data: paymentData, error: paymentError } = await supabaseAdmin
            .from('payment_records')
            .select('paid_amount, method')
            .gte('paid_at', startDate)
            .lt('paid_at', endDate);

        if (paymentError) {
            return NextResponse.json({ error: paymentError.message }, { status: 500 });
        }

        const revenue = (paymentData || []).reduce((sum, r) => sum + (Number(r.paid_amount) || 0), 0);
        const wechatRevenue = (paymentData || [])
            .filter(r => r.method === '微信支付')
            .reduce((sum, r) => sum + (Number(r.paid_amount) || 0), 0);
        const alipayRevenue = (paymentData || [])
            .filter(r => r.method === '支付宝')
            .reduce((sum, r) => sum + (Number(r.paid_amount) || 0), 0);

        // Fetch cost from expense_records
        const { data: expenseData, error: expenseError } = await supabaseAdmin
            .from('expense_records')
            .select('expense_amount')
            .gte('expense_date', startDate)
            .lt('expense_date', endDate);

        if (expenseError) {
            return NextResponse.json({ error: expenseError.message }, { status: 500 });
        }

        const cost = (expenseData || []).reduce((sum, r) => sum + (Number(r.expense_amount) || 0), 0);
        const profit = revenue - cost;

        return NextResponse.json({ revenue, cost, profit, wechatRevenue, alipayRevenue });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}
