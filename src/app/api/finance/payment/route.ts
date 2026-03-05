import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

function calcStatus(paidPeriod: number, payablePeriod: number, dueDateStr: string): string {
    const now = new Date().getTime();
    const due = dueDateStr ? new Date(dueDateStr).getTime() : null;
    if (paidPeriod >= payablePeriod && payablePeriod > 0) return 'paid';
    if (paidPeriod > 0 && paidPeriod < payablePeriod) {
        if (due && due < now) return 'overdue';
        return 'partial';
    }
    if (due && due < now) return 'overdue';
    return 'unpaid';
}

// Fields that can be updated via renewal and should be logged
const TRACKED_RENEWAL_FIELDS: { key: string; label: string }[] = [
    { key: 'has_contract', label: '是否有合同' },
    { key: 'contract_end_date', label: '合同截止日期' },
    { key: 'payment_due_date', label: '下次收款日期' },
    { key: 'pay_cycle_months', label: '付款周期(月)' },
    { key: 'billing_fee_month', label: '月收费金额' },
    { key: 'standard_price', label: '标准价格' },
    { key: 'discount_gap', label: '优惠差额' },
];

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            customer_id,
            receivable_id,
            paid_at,
            paid_amount,
            method,
            note,
            screenshot,
            // Renewal confirmation fields (Step E)
            renewal,         // object with updated field values (only changed ones present)
            change_reasons,  // { field_name: reason_string }
        } = body;

        // --- Validation ---
        if (!customer_id) return NextResponse.json({ error: '请选择客户' }, { status: 400 });
        if (!receivable_id) return NextResponse.json({ error: '请选择应收账单' }, { status: 400 });
        if (!paid_at) return NextResponse.json({ error: '请填写收款日期' }, { status: 400 });
        const amount = Number(paid_amount);
        if (!amount || amount <= 0) return NextResponse.json({ error: '收款金额必须大于 0' }, { status: 400 });

        // Validate change_reasons covers all changed fields in renewal
        if (renewal && change_reasons) {
            for (const field of TRACKED_RENEWAL_FIELDS) {
                if (renewal[field.key] !== undefined && !change_reasons[field.key]) {
                    return NextResponse.json(
                        { error: `字段"${field.label}"有变更，请填写变更原因` },
                        { status: 400 }
                    );
                }
            }
        }

        const supabase = createAdminClient();

        // Fetch current receivable for comparison and balance check
        const { data: receivable, error: fetchErr } = await supabase
            .from('company_receivables')
            .select('*')
            .eq('id', receivable_id)
            .single();

        if (fetchErr || !receivable) {
            return NextResponse.json({ error: '账单不存在' }, { status: 404 });
        }

        const paidSoFar = Number(receivable.amount_paid_period || 0);
        const payable = Number(receivable.amount_payable_period || 0);
        const remaining = payable - paidSoFar;

        if (amount > remaining + 0.01) {
            return NextResponse.json({
                error: `收款金额 ¥${amount} 超过未收余额 ¥${remaining.toFixed(2)}，请拆分或选择其他账单`
            }, { status: 400 });
        }

        // --- Step 1: Insert payment record ---
        const { error: insertErr } = await supabase.from('payment_records').insert({
            customer_id,
            receivable_id,
            paid_at,
            paid_amount: amount,
            method: method || null,
            note: note || null,
            screenshot: screenshot || null,
        });

        if (insertErr) {
            console.error('[payment API] insert error:', insertErr);
            return NextResponse.json({ error: insertErr.message }, { status: 500 });
        }

        // --- Step 2 & 3: Update amount_paid_period + recalculate status ---
        const newPaid = paidSoFar + amount;
        // Use new payment_due_date if provided in renewal, otherwise use existing
        const dueDateForStatus = (renewal?.payment_due_date) ?? receivable.payment_due_date;
        const newStatus = calcStatus(newPaid, payable, dueDateForStatus);

        // --- Step 4: Build renewal update object ---
        const receivableUpdates: Record<string, any> = {
            amount_paid_period: newPaid,
            status: newStatus,
        };

        const changeLogs: Array<{
            customer_id: string;
            receivable_id: string;
            change_reason: string;
            change_type: string;
            field_name: string;
            old_value: string | null;
            new_value: string | null;
        }> = [];

        if (renewal && change_reasons) {
            for (const { key } of TRACKED_RENEWAL_FIELDS) {
                if (renewal[key] === undefined) continue;

                const oldVal = receivable[key];
                const newVal = renewal[key];

                // Skip if no actual change
                const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal);
                const newStr = newVal === null || newVal === undefined ? '' : String(newVal);
                if (oldStr === newStr) continue;

                receivableUpdates[key] = newVal;
                changeLogs.push({
                    customer_id,
                    receivable_id,
                    change_reason: change_reasons[key] || '续签确认',
                    change_type: 'renewal_confirmation',
                    field_name: key,
                    old_value: oldStr || null,
                    new_value: newStr || null,
                });
            }
        }

        // Apply receivable updates
        const { error: updateErr } = await supabase
            .from('company_receivables')
            .update(receivableUpdates)
            .eq('id', receivable_id);

        if (updateErr) {
            console.error('[payment API] update receivable error:', updateErr);
            return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        // --- Step 5: Log all changes ---
        if (changeLogs.length > 0) {
            const { error: logErr } = await supabase
                .from('receivable_change_logs')
                .insert(changeLogs);
            if (logErr) {
                console.error('[payment API] change log error:', logErr);
                // Non-fatal — log but don't fail the transaction
            }
        }

        return NextResponse.json({
            success: true,
            newPaid,
            newStatus,
            remaining: payable - newPaid,
            changeLogsWritten: changeLogs.length,
        });

    } catch (err: any) {
        console.error('[payment API] unexpected error:', err);
        return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
    }
}
