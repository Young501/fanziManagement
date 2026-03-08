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
        const now = new Date();
        const currentYear = now.getFullYear();

        // Query all relevant receivables
        const { data: receivables, error: recErr } = await supabase
            .from('company_receivables')
            .select('amount_payable_period, amount_paid_period, status, payment_due_date, customer_id');

        if (recErr) {
            console.error('[finance customers stats API] receivables error:', recErr);
            return noStoreJson({ error: recErr.message }, 500);
        }

        let totalPayable = 0; // 年度应收 = 过去年的逾期 + 今年的待付款
        let totalPaid = 0;    // 年度已付汇总 = 应付日期在今年的收款
        const arrearsCustomerIds = new Set<string>();

        for (const r of receivables || []) {
            const dueDate = r.payment_due_date ? new Date(r.payment_due_date) : null;
            if (!dueDate) continue;

            const dueDateYear = dueDate.getFullYear();
            const payable = Number(r.amount_payable_period || 0);
            const paid = Number(r.amount_paid_period || 0);
            const remaining = Math.max(0, payable - paid);

            // 1. 计算年度应收：过去年的逾期单 (remaining > 0) + 今年的待付款单 (remaining > 0)
            if (dueDateYear <= currentYear && remaining > 0) {
                totalPayable += remaining;

                // 逾期统计：应付日期已过且还有欠款
                if (dueDate.getTime() < now.getTime()) {
                    if (r.customer_id) arrearsCustomerIds.add(r.customer_id);
                }
            }

            // 2. 计算年度已付汇总：统计 应付日期在今年的单子 的已付金额
            // 无论是否付清，只要这笔账是算在今年的，它的已收金额就计入年度汇总
            if (dueDateYear === currentYear) {
                totalPaid += paid;
            }
        }

        return noStoreJson({
            totalPayable,
            totalPaid,
            arrearsCount: arrearsCustomerIds.size,
            normalCount: (receivables?.length || 0) - arrearsCustomerIds.size,
            totalReceivables: receivables?.length || 0,
        });
    } catch (err: any) {
        console.error('[finance customers stats API] unexpected error:', err);
        return noStoreJson({ error: err?.message ?? 'Internal server error' }, 500);
    }
}
