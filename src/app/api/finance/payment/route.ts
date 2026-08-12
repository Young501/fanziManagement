import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { calculateReceivableStatus } from '@/lib/finance-status';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
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

        if (!is_ad_hoc && !customer_id) return noStoreJson({ error: '请选择客户' }, 400);
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
        const warnings: string[] = [];

        if (is_ad_hoc) {
            const { data: newAdHoc, error: adHocErr } = await supabase
                .from('customer_ad_hoc_services')
                .insert({
                    customer_id: customer_id || null,
                    service_name: ad_hoc_service_name,
                    service_date: paid_at,
                    amount_receivable: amount,
                    amount_received: amount,
                    status: 'paid',
                    invoice_status: 'not_required',
                    description: note || '一次性临时业务入账',
                })
                .select('id')
                .single();

            if (adHocErr || !newAdHoc) {
                console.error('[payment API] ad_hoc insert error:', adHocErr);
                return noStoreJson({ error: '生成系统底账失败，请重试' }, 500);
            }

            // Also insert a payment_records entry so this shows up in payment history
            const { error: prErr } = await supabase.from('payment_records').insert({
                customer_id: customer_id || null,
                receivable_id: null,
                ad_hoc_service_id: newAdHoc.id,
                paid_at,
                paid_amount: amount,
                method: method || null,
                note: note || null,
                screenshot: screenshot || null,
            });

            if (prErr) {
                console.error('[payment API] ad_hoc payment_records insert error:', prErr);
                await supabase.from('customer_ad_hoc_services').delete().eq('id', newAdHoc.id);
                return noStoreJson({ error: '收款记录保存失败，临时业务底账已回滚，请重试' }, 500);
            }

            return noStoreJson({ success: true, newPaid: amount, newStatus: 'paid', remaining: 0, changeLogsWritten: 0 });
        }


        // 2. Update receivable status and handle renewal if provided
        const { data: currentReceivable, error: fetchErr } = await supabase
            .from('company_receivables')
            .select('*, customers(customer_status)')
            .eq('id', receivable_id)
            .single();

        if (fetchErr || !currentReceivable) throw new Error('找不到对应的应收款项');
        if (currentReceivable.customer_id !== customer_id) {
            return noStoreJson({ error: '所选账单不属于当前客户，请重新选择账单' }, 400);
        }
        if (currentReceivable.customers?.customer_status === '流失') {
            return noStoreJson({ error: '该客户已流失，不能登记周期收款。请先恢复客户状态或登记为一次性收款' }, 400);
        }

        const paidSoFar = Number(currentReceivable.amount_paid_period || 0);
        const payable = Number(currentReceivable.amount_payable_period || 0);
        const hasDiscountOverride = discounted_payable !== undefined && discounted_payable !== null && discounted_payable !== '';
        const discountOverride = hasDiscountOverride ? Number(discounted_payable) : null;
        const currentPayable = hasDiscountOverride ? Number(discountOverride) : payable;

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

        const newPaid = paidSoFar + amount;
        const isFinishing = newPaid >= currentPayable - 0.01;
        const shouldCreateNextCycle = isFinishing && renewal && Number(renewal.pay_cycle_months || 0) > 0;
        const generatedNote = `由账单 ${receivable_id} 完清后自动生成`;

        if (shouldCreateNextCycle) {
            const nextPayable = Number(renewal.amount_payable_period || 0);
            const nextCycleMonths = Number(renewal.pay_cycle_months || 0);
            const nextDueDate = String(renewal.payment_due_date || '');

            if (!Number.isInteger(nextCycleMonths) || nextCycleMonths <= 0) {
                return noStoreJson({ error: '下一周期付款周期不正确' }, 400);
            }
            if (!Number.isFinite(nextPayable) || nextPayable < 0) {
                return noStoreJson({ error: '下一周期应收金额不正确' }, 400);
            }
            if (!nextDueDate || Number.isNaN(new Date(`${nextDueDate}T00:00:00`).getTime())) {
                return noStoreJson({ error: '下一周期收款日期不正确' }, 400);
            }
        }

        const { data: paymentRecord, error: insertErr } = await supabase.from('payment_records').insert({
            customer_id,
            receivable_id,
            paid_at,
            paid_amount: amount,
            method: method || null,
            note: note || null,
            screenshot: screenshot || null,
            negotiated_discount_amount: hasDiscountOverride ? Math.max(0, payable - currentPayable) : null,
            discount_reason: hasDiscountOverride ? discount_reason || null : null,
        }).select('id').single();

        if (insertErr || !paymentRecord) {
            console.error('[payment API] insert error:', insertErr);
            return noStoreJson({ error: insertErr?.message || '收款记录保存失败' }, 500);
        }

        const dueDateForStatus = currentReceivable.payment_due_date;
        const newStatus = calculateReceivableStatus(newPaid, currentPayable, dueDateForStatus);

        // Logic fix: 
        // 1. We ALWAYS update the current record with the final paid amount and status.
        // 2. We NO LONGER reset amount_paid_period to 0 on the CURRENT record.
        const receivableUpdates: Record<string, unknown> = {
            amount_paid_period: newPaid,
            status: newStatus,
            current_receipt_date: paid_at,
            current_receipt_amount: amount,
        };

        if (hasDiscountOverride) {
            receivableUpdates.amount_payable_period = currentPayable;
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

        if (hasDiscountOverride && currentPayable !== payable) {
            changeLogs.push({
                customer_id,
                receivable_id,
                change_reason: discount_reason || '本期收款协商优惠',
                change_type: 'one_off_discount',
                field_name: 'amount_payable_period',
                old_value: String(payable),
                new_value: String(currentPayable),
            });
        }

        // Apply changes to the CURRENT record
        const { error: updateErr } = await supabase
            .from('company_receivables')
            .update(receivableUpdates)
            .eq('id', receivable_id);

        if (updateErr) {
            console.error('[payment API] update receivable error:', updateErr);
            await supabase.from('payment_records').delete().eq('id', paymentRecord.id);
            return noStoreJson({ error: updateErr.message }, 500);
        }

        if (shouldCreateNextCycle) {
            const { count: existingGeneratedCount } = await supabase
                .from('company_receivables')
                .select('*', { count: 'exact', head: true })
                .eq('customer_id', customer_id)
                .eq('note', generatedNote);

            if ((existingGeneratedCount || 0) > 0) {
                warnings.push('下一周期账单已存在，系统未重复生成');
            } else {
                const nextReceivableData = {
                    customer_id,
                    status: calculateReceivableStatus(0, Number(renewal.amount_payable_period || 0), renewal.payment_due_date),
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
                    note: generatedNote
                };

                const { error: createErr } = await supabase
                    .from('company_receivables')
                    .insert(nextReceivableData);

                if (createErr) {
                    console.error('[payment API] create next cycle receivable error:', createErr);
                    warnings.push(`收款已登记，但下一周期账单生成失败: ${createErr.message}`);
                }
            }

            // Log changes as part of the renewal confirmation
            if (change_reasons && typeof change_reasons === 'object') {
                for (const { key } of TRACKED_RENEWAL_FIELDS) {
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
            if (logErr) {
                console.error('[payment API] change log error:', logErr);
                warnings.push(`变更日志写入失败: ${logErr.message}`);
            }
        }

        return noStoreJson({
            success: true,
            newPaid,
            newStatus,
            remaining: currentPayable - newPaid,
            changeLogsWritten: changeLogs.length,
            warnings,
        });
    } catch (err: unknown) {
        console.error('[payment API] unexpected error:', err);
        const message = err instanceof Error ? err.message : 'Internal server error';
        return noStoreJson({ error: message }, 500);
    }
}
