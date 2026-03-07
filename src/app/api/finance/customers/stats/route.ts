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
            .select('id, amount_payable_period, amount_paid_period, status, payment_due_date, customer_id');

        if (error) {
            console.error('[finance customers stats API] error:', error);
            return noStoreJson({ error: error.message }, 500);
        }

        let totalPayable = 0;
        let totalPaid = 0;

        // Fetch payment records to calculate true paid amount
        const recIds = data?.map(r => r.id) || [];
        const { data: allPayments } = await supabase
            .from('payment_records')
            .select('receivable_id, paid_amount')
            .in('receivable_id', recIds);

        const paymentMap: Record<string, number> = {};
        allPayments?.forEach(p => {
            paymentMap[p.receivable_id] = (paymentMap[p.receivable_id] || 0) + Number(p.paid_amount || 0);
        });

        const arrearsCustomerIds = new Set<string>();
        const now = Date.now();

        for (const r of data || []) {
            const payable = Number(r.amount_payable_period || 0);
            totalPayable += payable;

            const sumPaid = paymentMap[(r as any).id] || 0;
            const statusText = String(r.status || 'unpaid').toLowerCase();
            const isActuallyPaid = statusText === 'paid';
            const isPending = statusText === 'pending';

            let effectivePaid = sumPaid;
            if (isActuallyPaid) {
                effectivePaid = sumPaid > 0 ? sumPaid : payable;
            } else if (isPending && sumPaid === 0) {
                effectivePaid = Number((r as any).current_receipt_amount || 0);
            }

            totalPaid += effectivePaid;

            const isOverdue = r.payment_due_date ? new Date(r.payment_due_date).getTime() < now : false;
            const dueDateTs = r.payment_due_date ? new Date(r.payment_due_date).getTime() : 0;
            const isWithin45Days = dueDateTs > 0 && (dueDateTs - now) <= (45 * 24 * 60 * 60 * 1000);

            // Arrears should only count records that are TRULY unpaid and PAST due date.
            // Even if a 'paid' record is within 45 days, it's not 'Arrears' (欠费) yet.
            if (!isActuallyPaid && !isPending && isOverdue) {
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
