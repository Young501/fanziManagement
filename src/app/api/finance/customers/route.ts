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
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') ?? '1', 10);
        const limit = parseInt(searchParams.get('limit') ?? '10', 10);
        const search = searchParams.get('search') ?? '';
        const status = searchParams.get('status') ?? '';

        const offset = (page - 1) * limit;
        const supabase = createAdminClient();

        let query = supabase
            .from('company_receivables')
            .select(`
                *,
                customers!inner (
                    id,
                    company_name,
                    contact_person,
                    contact_info,
                    service_manager
                )
            `, { count: 'exact' });

        if (search.trim()) {
            query = query.ilike('customers.company_name', `%${search}%`);
        }

        if (status.trim()) {
            // Need to handle derived financial statuses
            // "已付清" (Paid In Full): amount_paid_period >= amount_payable_period AND amount_payable_period > 0
            // "已逾期" (Overdue): payment_due_date < NOW() AND amount_paid_period < amount_payable_period
            // "未付款" (Unpaid / Partial): amount_paid_period < amount_payable_period AND payment_due_date >= NOW()

            const todayStr = new Date().toISOString().split('T')[0];

            if (status === '已付清') {
                // We cannot easily do column-to-column comparisons in standard Supabase REST (amount_paid >= amount_payable).
                // But we can filter those out post-query or via a view. For simple implementation,
                // we'll fetch more data and filter in JS before paginating.
                // To keep it simple, we will defer filtering to JavaScript if a status is passed for this specific requirement.
            }
        }

        // We will fetch ALL matching the search, then filter and paginate in memory 
        // because column comparison (paid < payable) isn't natively supported in all simple PostgREST setups without RPC.
        // Let's modify the flow to support this.

        let allDataQuery = supabase
            .from('company_receivables')
            .select(`
                *,
                customers!inner (
                    id,
                    company_name,
                    contact_person,
                    contact_info,
                    service_manager
                )
            `);

        if (search.trim()) {
            allDataQuery = allDataQuery.ilike('customers.company_name', `%${search}%`);
        }

        const { data: allData, error } = await allDataQuery.order('payment_due_date', { ascending: true });

        if (error) {
            console.error('[finance customers API] error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        let filteredData = allData || [];

        if (status.trim()) {
            const now = new Date().getTime();
            filteredData = filteredData.filter((item: any) => {
                const _paid = Number(item.amount_paid_period || 0);
                const _payable = Number(item.amount_payable_period || 0);
                const isOverdue = item.payment_due_date ? new Date(item.payment_due_date).getTime() < now : false;

                if (status === '已付清') {
                    return _paid >= _payable && _payable > 0;
                } else if (status === '已逾期') {
                    return _paid < _payable && isOverdue;
                } else if (status === '未付款') {
                    return _paid < _payable && !isOverdue;
                }
                return true;
            });
        }

        const count = filteredData.length;
        const paginatedData = filteredData.slice(offset, offset + limit);

        return NextResponse.json({
            data: paginatedData,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
        });
    } catch (err: any) {
        console.error('[finance customers API] unexpected error:', err);
        return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
    }
}
