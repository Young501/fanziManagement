import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { calculateReceivableStatus } from '@/lib/finance-status';

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

async function getRole() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    return profile?.role || null;
}

function canManagePaymentHistory(role: string | null) {
    const normalized = role?.toLowerCase();
    return normalized === 'admin' || normalized === 'manager';
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parsePositiveAmount(value: unknown, label: string) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`${label}必须大于 0`);
    }
    return amount;
}

function assertDateOnly(value: unknown, label: string) {
    const date = typeof value === 'string' ? value.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
        throw new Error(`请填写正确的${label}`);
    }
    return date;
}

async function getLatestPaymentForReceivable(
    supabase: ReturnType<typeof createAdminClient>,
    receivableId: string,
    excludedPaymentId?: string
) {
    let query = supabase
        .from('payment_records')
        .select('id, paid_at, paid_amount')
        .eq('receivable_id', receivableId)
        .order('paid_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

    if (excludedPaymentId) {
        query = query.neq('id', excludedPaymentId);
    }

    const { data } = await query;
    return data?.[0] || null;
}

async function updateReceivableAfterPaymentChange(
    supabase: ReturnType<typeof createAdminClient>,
    receivableId: string,
    nextPaidAmount: number,
    excludedPaymentId?: string,
    nextPayableAmount?: number
) {
    const { data: receivable, error } = await supabase
        .from('company_receivables')
        .select('id, amount_paid_period, amount_payable_period, payment_due_date')
        .eq('id', receivableId)
        .single();

    if (error || !receivable) {
        throw new Error(error?.message || '找不到对应账单');
    }

    const payable = nextPayableAmount ?? Number(receivable.amount_payable_period || 0);
    if (nextPaidAmount > payable + 0.01) {
        throw new Error(`调整后已收金额 ￥${nextPaidAmount.toFixed(2)} 不能超过本期应收 ￥${payable.toFixed(2)}`);
    }

    const latestPayment = await getLatestPaymentForReceivable(supabase, receivableId, excludedPaymentId);
    const status = calculateReceivableStatus(nextPaidAmount, payable, receivable.payment_due_date);

    const { error: updateError } = await supabase
        .from('company_receivables')
        .update({
            amount_paid_period: nextPaidAmount,
            amount_payable_period: payable,
            status,
            current_receipt_date: latestPayment?.paid_at || null,
            current_receipt_amount: latestPayment?.paid_amount || null,
        })
        .eq('id', receivableId);

    if (updateError) {
        throw new Error(updateError.message);
    }

    return { status, payable };
}

async function cleanupGeneratedNextReceivable(supabase: ReturnType<typeof createAdminClient>, receivableId: string) {
    const generatedNote = `由账单 ${receivableId} 完清后自动生成`;
    const { data: generatedReceivables } = await supabase
        .from('company_receivables')
        .select('id, amount_paid_period, note')
        .eq('note', generatedNote);

    const warnings: string[] = [];

    for (const rec of generatedReceivables || []) {
        const paid = Number(rec.amount_paid_period || 0);
        if (paid > 0) {
            warnings.push('下一期账单已有收款，未自动删除');
            continue;
        }

        const { count: linkedPayments } = await supabase
            .from('payment_records')
            .select('*', { count: 'exact', head: true })
            .eq('receivable_id', rec.id);

        if ((linkedPayments || 0) > 0) {
            warnings.push('下一期账单已有收款记录，未自动删除');
            continue;
        }

        await supabase.from('collection_tasks').delete().eq('receivable_id', rec.id);
        const { error: deleteError } = await supabase
            .from('company_receivables')
            .delete()
            .eq('id', rec.id);

        if (deleteError) {
            warnings.push(`下一期账单删除失败: ${deleteError.message}`);
        }
    }

    return warnings;
}

async function syncAdHocServiceAfterPaymentChange(
    supabase: ReturnType<typeof createAdminClient>,
    adHocServiceId: string,
    paymentId: string,
    nextAmount?: number,
    nextNote?: string,
    deleting = false
) {
    const { data: currentPayments } = await supabase
        .from('payment_records')
        .select('id, paid_amount')
        .eq('ad_hoc_service_id', adHocServiceId);

    const remainingPayments = (currentPayments || [])
        .filter((payment) => deleting ? payment.id !== paymentId : true)
        .map((payment) => {
            if (!deleting && payment.id === paymentId && nextAmount !== undefined) {
                return { ...payment, paid_amount: nextAmount };
            }
            return payment;
        });

    const received = remainingPayments.reduce((sum, payment) => sum + Number(payment.paid_amount || 0), 0);

    if (deleting && remainingPayments.length === 0) {
        await supabase.from('customer_ad_hoc_services').delete().eq('id', adHocServiceId);
        return;
    }

    const updates: Record<string, unknown> = {
        amount_received: received,
        status: received > 0 ? 'paid' : 'unpaid',
    };

    if (nextAmount !== undefined) {
        updates.amount_receivable = Math.max(received, nextAmount);
    }

    if (nextNote !== undefined) {
        if (/(-|－)/.test(nextNote)) {
            const parts = nextNote.split(/\s*[-－]\s*/);
            updates.service_name = parts[0].trim();
            updates.description = parts.slice(1).join(' - ').trim();
        } else {
            updates.description = nextNote;
        }
    }

    await supabase
        .from('customer_ad_hoc_services')
        .update(updates)
        .eq('id', adHocServiceId);
}

export async function GET(request: NextRequest) {
    try {
        const supabaseAuth = await createServerClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user) return noStoreJson({ error: '未授权，请先登录' }, 401);

        const supabaseAdmin = createAdminClient();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const start = (page - 1) * limit;
        const month = searchParams.get('month') || '';
        const paymentType = searchParams.get('paymentType') || '';
        const search = searchParams.get('search') || '';
        const method = searchParams.get('method') || '';

        const selectStr = search
            ? '*, customers!inner(company_name), company_receivables(billing_fee_month, pay_cycle_months, receipt_note), customer_ad_hoc_services(service_name, description)'
            : '*, customers(company_name), company_receivables(billing_fee_month, pay_cycle_months, receipt_note), customer_ad_hoc_services(service_name, description)';

        let query = supabaseAdmin
            .from('payment_records')
            .select(selectStr, { count: 'exact' });

        if (month) {
            const [year, mon] = month.split('-');
            const startDate = `${year}-${mon}-01`;
            const endYear = mon === '12' ? parseInt(year) + 1 : parseInt(year);
            const endMon = mon === '12' ? '01' : String(parseInt(mon) + 1).padStart(2, '0');
            const endDate = `${endYear}-${endMon}-01`;
            query = query.gte('paid_at', startDate).lt('paid_at', endDate);
        }

        if (paymentType === 'regular') {
            query = query.not('receivable_id', 'is', null);
        } else if (paymentType === 'adhoc') {
            query = query.is('receivable_id', null);
        }

        if (search) query = query.ilike('customers.company_name', `%${search}%`);
        if (method) query = query.eq('method', method);

        query = query.order('paid_at', { ascending: false }).order('created_at', { ascending: false });

        const { data, count, error } = await query.range(start, start + limit - 1);
        if (error) return noStoreJson({ error: error.message }, 500);

        const totalSelect = search ? 'paid_amount, customers!inner(company_name)' : 'paid_amount, customers(company_name)';
        let totalQuery = supabaseAdmin.from('payment_records').select(totalSelect);

        if (month) {
            const [year, mon] = month.split('-');
            const startDate = `${year}-${mon}-01`;
            const endYear = mon === '12' ? parseInt(year) + 1 : parseInt(year);
            const endMon = mon === '12' ? '01' : String(parseInt(mon) + 1).padStart(2, '0');
            const endDate = `${endYear}-${endMon}-01`;
            totalQuery = totalQuery.gte('paid_at', startDate).lt('paid_at', endDate);
        }
        if (paymentType === 'regular') totalQuery = totalQuery.not('receivable_id', 'is', null);
        if (paymentType === 'adhoc') totalQuery = totalQuery.is('receivable_id', null);
        if (search) totalQuery = totalQuery.ilike('customers.company_name', `%${search}%`);
        if (method) totalQuery = totalQuery.eq('method', method);

        const { data: totalData } = await totalQuery;
        const total = (totalData || []).reduce((sum, r) => sum + (r.paid_amount || 0), 0);
        const role = await getRole();

        return noStoreJson({ data, count, role, total });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal error';
        return noStoreJson({ error: message }, 500);
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const role = await getRole();
        if (!canManagePaymentHistory(role)) {
            return noStoreJson({ error: '权限不足，仅管理员或客户经理可删除' }, 403);
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return noStoreJson({ error: '缺失记录ID' }, 400);
        if (!isUuid(id)) return noStoreJson({ error: '无效的记录ID格式' }, 400);

        const supabase = createAdminClient();

        const { data: record, error: recordError } = await supabase
            .from('payment_records')
            .select('*')
            .eq('id', id)
            .single();

        if (recordError || !record) {
            return noStoreJson({ error: recordError?.message || '收款记录不存在' }, 404);
        }

        const warnings: string[] = [];
        let shouldCleanupGenerated = false;
        let receivableRollback: Record<string, unknown> | null = null;

        if (record.receivable_id) {
            const { data: receivable, error: receivableError } = await supabase
                .from('company_receivables')
                .select('amount_paid_period, amount_payable_period, status, current_receipt_date, current_receipt_amount')
                .eq('id', record.receivable_id)
                .single();

            if (receivableError || !receivable) {
                return noStoreJson({ error: receivableError?.message || '找不到对应账单' }, 404);
            }

            const discountRollback = Number(record.negotiated_discount_amount || 0);
            const nextPayable = Number(receivable.amount_payable_period || 0) + discountRollback;
            const nextPaid = Math.max(0, Number(receivable.amount_paid_period || 0) - Number(record.paid_amount || 0));
            receivableRollback = {
                amount_paid_period: Number(receivable.amount_paid_period || 0),
                amount_payable_period: Number(receivable.amount_payable_period || 0),
                status: receivable.status || null,
                current_receipt_date: receivable.current_receipt_date || null,
                current_receipt_amount: receivable.current_receipt_amount || null,
            };
            shouldCleanupGenerated = Number(receivable.amount_paid_period || 0) >= Number(receivable.amount_payable_period || 0) - 0.01;

            await updateReceivableAfterPaymentChange(supabase, record.receivable_id, nextPaid, id, nextPayable);
        }

        const { error } = await supabase
            .from('payment_records')
            .delete()
            .eq('id', id);

        if (error) {
            if (record.receivable_id && receivableRollback) {
                const { error: rollbackError } = await supabase
                    .from('company_receivables')
                    .update(receivableRollback)
                    .eq('id', record.receivable_id);

                if (rollbackError) {
                    console.error('[payment history DELETE] receivable rollback error:', rollbackError);
                }
            }
            return noStoreJson({ error: error.message }, 500);
        }

        if (record.ad_hoc_service_id) {
            await syncAdHocServiceAfterPaymentChange(supabase, record.ad_hoc_service_id, id, undefined, undefined, true);
        }
        if (record.receivable_id && shouldCleanupGenerated) {
            warnings.push(...await cleanupGeneratedNextReceivable(supabase, record.receivable_id));
        }

        return noStoreJson({ success: true, warnings });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal error';
        return noStoreJson({ error: message }, 500);
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const role = await getRole();
        if (!canManagePaymentHistory(role)) {
            return noStoreJson({ error: '权限不足，仅管理员或客户经理可修改' }, 403);
        }

        const body = await request.json();
        const { id, paid_at, paid_amount, method, negotiated_discount_amount, note } = body;

        if (!id || !isUuid(String(id))) return noStoreJson({ error: '无效的记录ID' }, 400);
        const nextPaidAt = paid_at !== undefined ? assertDateOnly(paid_at, '收款日期') : undefined;
        const nextPaidAmount = paid_amount !== undefined ? parsePositiveAmount(paid_amount, '收款金额') : undefined;

        if (method !== undefined && String(method).length > 50) return noStoreJson({ error: '支付方式长度超限' }, 400);
        if (note !== undefined && String(note).length > 1000) return noStoreJson({ error: '备注过长' }, 400);

        const nextDiscount = negotiated_discount_amount !== undefined ? Number(negotiated_discount_amount) : undefined;
        if (nextDiscount !== undefined && (!Number.isFinite(nextDiscount) || nextDiscount < 0)) {
            return noStoreJson({ error: '优惠金额不能为负数' }, 400);
        }

        const supabase = createAdminClient();

        const { data: oldRecord, error: fetchError } = await supabase
            .from('payment_records')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !oldRecord) {
            return noStoreJson({ error: fetchError?.message || '记录不存在' }, 404);
        }

        const warnings: string[] = [];

        let nextReceivablePaid: number | null = null;
        let receivablePayable: number | null = null;
        let wasReceivablePaid = false;

        if (oldRecord.receivable_id && (nextPaidAmount !== undefined || nextDiscount !== undefined)) {
            const { data: receivable, error: receivableError } = await supabase
                .from('company_receivables')
                .select('amount_paid_period, amount_payable_period')
                .eq('id', oldRecord.receivable_id)
                .single();

            if (receivableError || !receivable) {
                return noStoreJson({ error: receivableError?.message || '找不到对应账单' }, 404);
            }

            const oldAmount = Number(oldRecord.paid_amount || 0);
            const desiredAmount = nextPaidAmount ?? oldAmount;
            const currentPaid = Number(receivable.amount_paid_period || 0);
            const currentPayable = Number(receivable.amount_payable_period || 0);
            const oldDiscount = Number(oldRecord.negotiated_discount_amount || 0);
            const desiredDiscount = nextDiscount ?? oldDiscount;
            const discountDelta = desiredDiscount - oldDiscount;

            nextReceivablePaid = Math.max(0, currentPaid - oldAmount + desiredAmount);
            receivablePayable = currentPayable - discountDelta;
            wasReceivablePaid = currentPaid >= currentPayable - 0.01;

            if (receivablePayable < 0) {
                return noStoreJson({ error: '调整后本期应收金额不能小于 0' }, 400);
            }

            if (nextReceivablePaid > receivablePayable + 0.01) {
                return noStoreJson({ error: `调整后已收金额 ￥${nextReceivablePaid.toFixed(2)} 不能超过本期应收 ￥${receivablePayable.toFixed(2)}` }, 400);
            }
        }

        const updates: Record<string, unknown> = {};
        if (nextPaidAt !== undefined) updates.paid_at = nextPaidAt;
        if (nextPaidAmount !== undefined) updates.paid_amount = nextPaidAmount;
        if (method !== undefined) updates.method = method || null;
        if (nextDiscount !== undefined) updates.negotiated_discount_amount = nextDiscount;
        if (note !== undefined) updates.note = note || null;

        if (Object.keys(updates).length === 0) {
            return noStoreJson({ error: '没有可更新的字段' }, 400);
        }

        const { error: updateError } = await supabase
            .from('payment_records')
            .update(updates)
            .eq('id', id);

        if (updateError) return noStoreJson({ error: updateError.message }, 500);

        try {
            if (oldRecord.receivable_id && nextReceivablePaid !== null && receivablePayable !== null) {
                await updateReceivableAfterPaymentChange(supabase, oldRecord.receivable_id, nextReceivablePaid, undefined, receivablePayable);

                if (wasReceivablePaid && nextReceivablePaid < receivablePayable - 0.01) {
                    warnings.push(...await cleanupGeneratedNextReceivable(supabase, oldRecord.receivable_id));
                }
                if (!wasReceivablePaid && nextReceivablePaid >= receivablePayable - 0.01) {
                    warnings.push('账单已重新计算为已收，系统未自动生成下一期账单，请确认是否需要补建续费账单');
                }
            } else if (oldRecord.receivable_id && nextPaidAt !== undefined) {
                const { data: receivable } = await supabase
                    .from('company_receivables')
                    .select('amount_paid_period, amount_payable_period')
                    .eq('id', oldRecord.receivable_id)
                    .single();

                if (receivable) {
                    await updateReceivableAfterPaymentChange(
                        supabase,
                        oldRecord.receivable_id,
                        Number(receivable.amount_paid_period || 0),
                        undefined,
                        Number(receivable.amount_payable_period || 0)
                    );
                }
            }

            if (oldRecord.ad_hoc_service_id && (nextPaidAmount !== undefined || note !== undefined)) {
                await syncAdHocServiceAfterPaymentChange(
                    supabase,
                    oldRecord.ad_hoc_service_id,
                    id,
                    nextPaidAmount,
                    note,
                    false
                );
            }
        } catch (dependencyErr) {
            const { error: rollbackError } = await supabase
                .from('payment_records')
                .update({
                    paid_at: oldRecord.paid_at,
                    paid_amount: oldRecord.paid_amount,
                    negotiated_discount_amount: oldRecord.negotiated_discount_amount,
                    method: oldRecord.method,
                    note: oldRecord.note,
                })
                .eq('id', id);

            if (rollbackError) {
                console.error('[payment history PATCH] payment rollback error:', rollbackError);
            }

            const message = dependencyErr instanceof Error ? dependencyErr.message : '关联账单同步失败';
            return noStoreJson({ error: message }, 500);
        }

        return noStoreJson({ success: true, warnings });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal error';
        return noStoreJson({ error: message }, 500);
    }
}
