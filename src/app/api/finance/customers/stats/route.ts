import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(_request: NextRequest) {
    try {
        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('company_receivables')
            .select('amount_payable_period, amount_paid_period, status, payment_due_date, customer_id');

        if (error) {
            console.error('[finance customers stats API] error:', error);
            return noStoreJson({ error: error.message }, 500);
        }

        let totalPayable = 0;
        let totalPaid = 0;

        const arrearsCustomerIds = new Set<string>();
        const now = Date.now();

        for (const r of data || []) {
            totalPayable += Number(r.amount_payable_period || 0);
            totalPaid += Number(r.amount_paid_period || 0);

            const paid = Number(r.amount_paid_period || 0);
            const payable = Number(r.amount_payable_period || 0);
            const isOverdue = r.payment_due_date ? new Date(r.payment_due_date).getTime() < now : false;

            const statusText = String(r.status || '').toLowerCase();
            const explicitlyArrears = statusText.includes('arrear') || statusText.includes('overdue') || statusText.includes('unpaid');

            if (explicitlyArrears || (paid < payable && isOverdue)) {
                if (r.customer_id) arrearsCustomerIds.add(r.customer_id);
            }
        }

        return noStoreJson({
            totalPayable,
            totalPaid,
            arrearsCount: arrearsCustomerIds.size,
            normalCount: (data?.length || 0) - arrearsCustomerIds.size,
            totalReceivables: data?.length || 0,
        });
    } catch (err: any) {
        console.error('[finance customers stats API] unexpected error:', err);
        return noStoreJson({ error: err?.message ?? 'Internal server error' }, 500);
    }
}
