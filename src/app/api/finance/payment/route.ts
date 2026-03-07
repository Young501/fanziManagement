import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

function calcStatus(paidPeriod: number, payablePeriod: number, dueDateStr: string): string {
    const now = Date.now();
    const due = dueDateStr ? new Date(dueDateStr).getTime() : null;
    if (paidPeriod >= payablePeriod && payablePeriod > 0) return 'paid';
    if (paidPeriod > 0 && paidPeriod < payablePeriod) {
        if (due && due < now) return 'overdue';
        return 'partial';
    }
    if (due && due < now) return 'overdue';
    return 'unpaid';
}

const TRACKED_RENEWAL_FIELDS: { key: string; label: string }[] = [
    { key: 'has_contract', label: '是否有合同' },
    { key: 'contract_end_date', label: '合同截止日期' },
    { key: 'payment_due_date', label: '下次收款日期' },
    { key: 'pay_cycle_months', label: '付款周期(月)' },
    { key: 'amount_payable_period', label: '本期应收金额' },
    { key: 'billing_fee_month', label: '月收费金额' },
    { key: 'standard_price', label: '标准价格' },
    { key: 'discount_gap', label: '优惠差额' },
];

function noStoreJson(body: unknown, status = 200) {
    return NextResponse.json(body, {
        status,
        headers: { 'Cache-Control': 'no-store' },
    });
}

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
            renewal,
            change_reasons,
            is_ad_hoc,
            ad_hoc_service_name,
        } = body;

        if (!customer_id) return noStoreJson({ error: '请选择客户' }, 400);
        if (!paid_at || !/^\d{4}-\d{2}-\d{2}$/.test(String(paid_at))) return noStoreJson({ error: '请填写正确收款日期' }, 400);

        const amount = Number(paid_amount);
        if (!Number.isFinite(amount) || amount <= 0) return noStoreJson({ error: '收款金额必须大于 0' }, 400);

        if (method && String(method).length > 50) return noStoreJson({ error: '支付方式长度超限' }, 400);
        if (note && String(note).length > 1000) return noStoreJson({ error: '备注过长' }, 400);

        if (is_ad_hoc) {
            if (!ad_hoc_service_name || String(ad_hoc_service_name).trim().length === 0) {
                return noStoreJson({ error: '请填写服务项目名称' }, 400);
            }
        } else {
            if (!receivable_id) return noStoreJson({ error: '请选择应收账单' }, 400);
        }

        const supabase = createAdminClient();

        if (is_ad_hoc) {
            const { data: newReceivable, error: recErr } = await supabase
                .from('company_receivables')
                .insert({
                    customer_id,
                    amount_payable_period: amount,
                    amount_paid_period: amount,
                    payment_due_date: paid_at,
                    status: 'paid',
                    receipt_note: ad_hoc_service_name,
                    note: '一次性临时业务入账',
                })
                .select('id')
                .single();

            if (recErr || !newReceivable) {
                console.error('[payment API] ad_hoc insert error:', recErr);
                return noStoreJson({ error: '生成系统底账失败，请重试' }, 500);
            }

            const { error: insertErr } = await supabase.from('payment_records').insert({
                customer_id,
                receivable_id: newReceivable.id,
                paid_at,
                paid_amount: amount,
                method: method || null,
                note: note || null,
                screenshot: screenshot || null,
            });

            if (insertErr) {
                console.error('[payment API] payment insert error:', insertErr);
                return noStoreJson({ error: insertErr.message }, 500);
            }

            return noStoreJson({ success: true, newPaid: amount, newStatus: 'paid', remaining: 0, changeLogsWritten: 0 });
        }

        const { data: receivable, error: fetchErr } = await supabase
            .from('company_receivables')
            .select('*')
            .eq('id', receivable_id)
            .single();

        if (fetchErr || !receivable) {
            return noStoreJson({ error: '账单不存在' }, 404);
        }

        const paidSoFar = Number(receivable.amount_paid_period || 0);
        const payable = Number(receivable.amount_payable_period || 0);
        const negotiatedPayable = renewal?.amount_payable_period === undefined
            ? payable
            : Number(renewal.amount_payable_period);
        if (!Number.isFinite(negotiatedPayable) || negotiatedPayable < 0) {
            return noStoreJson({ error: '协商后本期应收金额不合法' }, 400);
        }
        if (negotiatedPayable < paidSoFar - 0.01) {
            return noStoreJson({ error: '协商后本期应收金额不能小于已收金额' }, 400);
        }

        const remaining = negotiatedPayable - paidSoFar;

        if (amount > remaining + 0.01) {
            return noStoreJson({ error: `收款金额 ￥${amount} 超过未收余额 ￥${remaining.toFixed(2)}` }, 400);
        }

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
            return noStoreJson({ error: insertErr.message }, 500);
        }

        const newPaid = paidSoFar + amount;
        const dueDateForStatus = renewal?.payment_due_date ?? receivable.payment_due_date;
        const newStatus = calcStatus(newPaid, negotiatedPayable, dueDateForStatus);

        const receivableUpdates: Record<string, unknown> = {
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

        if (renewal) {
            if (!change_reasons || typeof change_reasons !== 'object') {
                return noStoreJson({ error: '存在账单变更，请填写变更原因' }, 400);
            }

            for (const { key, label } of TRACKED_RENEWAL_FIELDS) {
                if (renewal[key] === undefined) continue;

                const oldVal = receivable[key];
                const newVal = renewal[key];
                const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal);
                const newStr = newVal === null || newVal === undefined ? '' : String(newVal);
                if (oldStr === newStr) continue;

                if (!change_reasons[key] || !String(change_reasons[key]).trim()) {
                    return noStoreJson({ error: `字段"${label}"有变更，请填写变更原因` }, 400);
                }

                receivableUpdates[key] = newVal;

                // Determine change_type based on the field
                let typeOfChange = 'renewal_confirmation';
                if (['amount_payable_period', 'standard_price', 'discount_gap'].includes(key)) {
                    typeOfChange = 'adjustment';
                }

                changeLogs.push({
                    customer_id,
                    receivable_id,
                    change_reason: String(change_reasons[key]),
                    change_type: typeOfChange,
                    field_name: key,
                    old_value: oldStr || null,
                    new_value: newStr || null,
                });
            }
        }

        const { error: updateErr } = await supabase
            .from('company_receivables')
            .update(receivableUpdates)
            .eq('id', receivable_id);

        if (updateErr) {
            console.error('[payment API] update receivable error:', updateErr);
            return noStoreJson({ error: updateErr.message }, 500);
        }

        if (changeLogs.length > 0) {
            const { error: logErr } = await supabase.from('receivable_change_logs').insert(changeLogs);
            if (logErr) console.error('[payment API] change log error:', logErr);
        }

        return noStoreJson({
            success: true,
            newPaid,
            newStatus,
            remaining: negotiatedPayable - newPaid,
            changeLogsWritten: changeLogs.length,
        });
    } catch (err: unknown) {
        console.error('[payment API] unexpected error:', err);
        const message = err instanceof Error ? err.message : 'Internal server error';
        return noStoreJson({ error: message }, 500);
    }
}
