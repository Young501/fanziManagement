import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
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
        // Auth check
        const authSupabase = await createServerClient();
        const { data: { user } } = await authSupabase.auth.getUser();
        if (!user) return noStoreJson({ error: '未授权，请先登录' }, 401);

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
            discount_reason,
            discounted_payable,
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
                    current_receipt_date: paid_at,
                    current_receipt_amount: amount,
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

        // 2. Update receivable status and handle renewal if provided
        const { data: currentReceivable, error: fetchErr } = await supabase
            .from('company_receivables')
            .select('*')
            .eq('id', receivable_id)
            .single();

        if (fetchErr || !currentReceivable) throw new Error('找不到对应的应收款项');

        const paidSoFar = Number(currentReceivable.amount_paid_period || 0);
        const payable = Number(currentReceivable.amount_payable_period || 0);
        const currentPayable = discounted_payable !== undefined
            ? Number(discounted_payable)
            : payable;

        if (!Number.isFinite(currentPayable) || currentPayable < 0) {
            return noStoreJson({ error: '协商后本期应收金额不合法' }, 400);
        }
        if (currentPayable < paidSoFar - 0.01) {
            return noStoreJson({ error: '协商后本期应收金额不能小于已收金额' }, 400);
        }

        const remaining = currentPayable - paidSoFar;

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
            negotiated_discount_amount: discounted_payable !== undefined ? Math.max(0, payable - currentPayable) : null,
            discount_reason: discounted_payable !== undefined ? discount_reason || null : null,
        });

        if (insertErr) {
            console.error('[payment API] insert error:', insertErr);
            return noStoreJson({ error: insertErr.message }, 500);
        }

        const newPaid = paidSoFar + amount;
        const isFinishing = newPaid >= currentPayable - 0.01;
        const dueDateForStatus = renewal?.payment_due_date ?? currentReceivable.payment_due_date;
        const newStatus = isFinishing ? 'paid' : calcStatus(newPaid, currentPayable, dueDateForStatus);

        // Logic fix: 
        // 1. We ALWAYS update the current record with the final paid amount and status.
        // 2. We NO LONGER reset amount_paid_period to 0 on the CURRENT record.
        const receivableUpdates: Record<string, unknown> = {
            amount_paid_period: newPaid,
            status: newStatus,
            current_receipt_date: paid_at,
            current_receipt_amount: amount,
        };

        if (discounted_payable !== undefined) {
            receivableUpdates.amount_payable_period = Number(discounted_payable);
        }

        const changeLogs: Array<{
            customer_id: string;
            receivable_id: string;
            change_reason: string;
            change_type: string;
            field_name: string;
            old_value: string | null;
            new_value: string | null;
        }> = [];

        if (discounted_payable !== undefined && Number(discounted_payable) !== payable) {
            changeLogs.push({
                customer_id,
                receivable_id,
                change_reason: discount_reason || '本期收款协商优惠',
                change_type: 'one_off_discount',
                field_name: 'amount_payable_period',
                old_value: String(payable),
                new_value: String(discounted_payable),
            });
        }

        // Apply changes to the CURRENT record
        const { error: updateErr } = await supabase
            .from('company_receivables')
            .update(receivableUpdates)
            .eq('id', receivable_id);

        if (updateErr) {
            console.error('[payment API] update receivable error:', updateErr);
            return noStoreJson({ error: updateErr.message }, 500);
        }

        // NEW: If finished and renewal info exists, create the NEXT CYCLE record
        if (isFinishing && renewal) {
            const nextReceivableData = {
                customer_id,
                status: 'unpaid',
                amount_paid_period: 0,
                // Fields from renewal
                has_contract: renewal.has_contract,
                contract_end_date: renewal.contract_end_date,
                payment_due_date: renewal.payment_due_date,
                pay_cycle_months: renewal.pay_cycle_months,
                billing_fee_month: renewal.billing_fee_month,
                amount_payable_period: renewal.amount_payable_period,
                standard_price: renewal.standard_price,
                discount_gap: renewal.discount_gap,
                // Any other context we want to carry over
                note: `由账单 ${receivable_id} 完清后自动生成`
            };

            const { data: nextRec, error: createErr } = await supabase
                .from('company_receivables')
                .insert(nextReceivableData)
                .select('id')
                .single();

            if (createErr) {
                console.error('[payment API] create next cycle receivable error:', createErr);
                // We don't fail the whole request since the payment was already recorded, but we log it.
            }

            // Log changes as part of the renewal confirmation
            if (change_reasons && typeof change_reasons === 'object') {
                for (const { key, label } of TRACKED_RENEWAL_FIELDS) {
                    if (renewal[key] === undefined) continue;

                    const oldVal = (currentReceivable as any)[key];
                    const newVal = (renewal as any)[key];
                    const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal);
                    const newStr = newVal === null || newVal === undefined ? '' : String(newVal);

                    if (oldStr === newStr) continue;

                    // Determine change_type based on the field
                    let typeOfChange = 'renewal_confirmation';
                    if (['amount_payable_period', 'standard_price', 'discount_gap'].includes(key)) {
                        typeOfChange = 'adjustment';
                    }

                    changeLogs.push({
                        customer_id,
                        receivable_id, // Keep linked to the record where the action happened
                        change_reason: String(change_reasons[key] || '系统自动顺延'),
                        change_type: typeOfChange,
                        field_name: key,
                        old_value: oldStr || null,
                        new_value: newStr || null,
                    });
                }
            }
        }

        if (changeLogs.length > 0) {
            const { error: logErr } = await supabase.from('receivable_change_logs').insert(changeLogs);
            if (logErr) console.error('[payment API] change log error:', logErr);
        }

        return noStoreJson({
            success: true,
            newPaid,
            newStatus,
            remaining: currentPayable - newPaid,
            changeLogsWritten: changeLogs.length,
        });
    } catch (err: unknown) {
        console.error('[payment API] unexpected error:', err);
        const message = err instanceof Error ? err.message : 'Internal server error';
        return noStoreJson({ error: message }, 500);
    }
}
