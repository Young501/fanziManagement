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

        // Fetch all receivables for basic stats aggregation
        const { data, error } = await supabase
            .from('company_receivables')
            .select('amount_payable_period, amount_paid_period, status, payment_due_date, customer_id');

        if (error) {
            console.error('[finance customers stats API] error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        let totalPayable = 0;
        let totalPaid = 0;

        const arrearsCustomerIds = new Set<string>();
        const now = new Date().getTime();

        for (const r of data || []) {
            totalPayable += Number(r.amount_payable_period || 0);
            totalPaid += Number(r.amount_paid_period || 0);

            const _paid = Number(r.amount_paid_period || 0);
            const _payable = Number(r.amount_payable_period || 0);
            const isOverdue = r.payment_due_date ? new Date(r.payment_due_date).getTime() < now : false;

            const explicitlyArrears = r.status?.toLowerCase().includes('欠') || r.status?.toLowerCase().includes('arrear') || r.status?.toLowerCase().includes('未付');

            // If it's explicitly marked as arrears, or it's not fully paid and past due
            if (explicitlyArrears || (_paid < _payable && isOverdue)) {
                if (r.customer_id) {
                    arrearsCustomerIds.add(r.customer_id);
                }
            }
        }

        return NextResponse.json({
            totalPayable,
            totalPaid,
            arrearsCount: arrearsCustomerIds.size,
            normalCount: (data?.length || 0) - arrearsCustomerIds.size,
            totalReceivables: data?.length || 0,
        });

    } catch (err: any) {
        console.error('[finance customers stats API] unexpected error:', err);
        return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
    }
}
