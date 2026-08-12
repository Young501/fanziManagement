import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { calculateReceivableStatus } from '@/lib/finance-status';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

const ALLOWED_STATUS = new Set(['open', 'in_progress', 'promised', 'completed', 'cancelled']);
const ALLOWED_PRIORITY = new Set(['P0', 'P1', 'P2']);

function noStoreJson(body: unknown, status = 200) {
    return NextResponse.json(body, {
        status,
        headers: { 'Cache-Control': 'no-store' },
    });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) return noStoreJson({ error: 'Missing task id' }, 400);

        const body = await request.json();
        const allowed = ['last_contact_at', 'next_followup_at', 'status', 'note', 'owner', 'priority'];
        const hasNegotiatedAmount = Object.prototype.hasOwnProperty.call(body, 'negotiated_payable_amount');
        const update: Record<string, unknown> = {};

        for (const key of allowed) {
            if (key in body) update[key] = body[key];
        }

        if (Object.keys(update).length === 0 && !hasNegotiatedAmount) {
            return noStoreJson({ error: 'No valid fields to update' }, 400);
        }

        if (update.status && !ALLOWED_STATUS.has(String(update.status))) {
            return noStoreJson({ error: 'Invalid status value' }, 400);
        }

        if (update.priority && !ALLOWED_PRIORITY.has(String(update.priority))) {
            return noStoreJson({ error: 'Invalid priority value' }, 400);
        }

        if (typeof update.note === 'string' && update.note.length > 1000) {
            return noStoreJson({ error: 'Note is too long' }, 400);
        }

        const negotiatedAmount = hasNegotiatedAmount ? Number(body.negotiated_payable_amount) : null;
        if (hasNegotiatedAmount && negotiatedAmount !== null && (!Number.isFinite(negotiatedAmount) || negotiatedAmount < 0)) {
            return noStoreJson({ error: 'Invalid negotiated payable amount' }, 400);
        }

        const adjustReason = typeof body.amount_adjust_reason === 'string' ? body.amount_adjust_reason.trim() : '';
        if (hasNegotiatedAmount && !adjustReason) {
            return noStoreJson({ error: '请填写调价原因' }, 400);
        }
        if (adjustReason.length > 500) {
            return noStoreJson({ error: 'Amount adjust reason is too long' }, 400);
        }

        const supabase = createAdminClient();

        let nextTargetAmount: number | null = null;
        let receivableRollback: { id: string; amount_payable_period: number; status: string | null } | null = null;
        let changeLogData: Record<string, unknown> | null = null;
        if (hasNegotiatedAmount) {
            const { data: taskBase, error: taskErr } = await supabase
                .from('collection_tasks')
                .select('id, customer_id, receivable_id')
                .eq('id', id)
                .single();

            if (taskErr || !taskBase) {
                console.error('[collection-tasks PATCH] fetch task error:', taskErr);
                return noStoreJson({ error: 'Task not found' }, 404);
            }

            if (!taskBase.receivable_id) {
                return noStoreJson({ error: 'Task has no receivable to adjust' }, 400);
            }

            const { data: receivable, error: recErr } = await supabase
                .from('company_receivables')
                .select('id, customer_id, amount_payable_period, amount_paid_period, payment_due_date, status')
                .eq('id', taskBase.receivable_id)
                .single();

            if (recErr || !receivable) {
                console.error('[collection-tasks PATCH] fetch receivable error:', recErr);
                return noStoreJson({ error: 'Receivable not found' }, 404);
            }

            const paid = Number(receivable.amount_paid_period || 0);
            const oldPayable = Number(receivable.amount_payable_period || 0);
            const newPayable = Number(negotiatedAmount);

            if (newPayable < paid - 0.01) {
                return noStoreJson({ error: '协商后应收金额不能小于已收金额' }, 400);
            }

            const nextStatus = calculateReceivableStatus(paid, newPayable, receivable.payment_due_date);
            nextTargetAmount = Math.max(0, newPayable - paid);
            receivableRollback = {
                id: receivable.id,
                amount_payable_period: oldPayable,
                status: receivable.status ?? null,
            };

            const { error: recUpdateErr } = await supabase
                .from('company_receivables')
                .update({
                    amount_payable_period: newPayable,
                    status: nextStatus,
                })
                .eq('id', receivable.id);

            if (recUpdateErr) {
                console.error('[collection-tasks PATCH] update receivable error:', recUpdateErr);
                return noStoreJson({ error: recUpdateErr.message }, 500);
            }

            changeLogData = {
                customer_id: receivable.customer_id,
                receivable_id: receivable.id,
                change_reason: adjustReason,
                change_type: 'collection_negotiation',
                field_name: 'amount_payable_period',
                old_value: String(oldPayable),
                new_value: String(newPayable),
            };
        }

        if (nextTargetAmount !== null) {
            update.target_amount = nextTargetAmount;
        }

        if (Object.keys(update).length === 0) {
            return noStoreJson({ data: { id } });
        }

        const { data, error } = await supabase
            .from('collection_tasks')
            .update(update)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[collection-tasks PATCH] error:', error);
            if (receivableRollback) {
                const { error: rollbackErr } = await supabase
                    .from('company_receivables')
                    .update({
                        amount_payable_period: receivableRollback.amount_payable_period,
                        status: receivableRollback.status,
                    })
                    .eq('id', receivableRollback.id);

                if (rollbackErr) {
                    console.error('[collection-tasks PATCH] rollback error:', rollbackErr);
                }
            }
            return noStoreJson({ error: error.message }, 500);
        }

        if (changeLogData) {
            const { error: logErr } = await supabase.from('receivable_change_logs').insert(changeLogData);
            if (logErr) {
                console.error('[collection-tasks PATCH] change log error:', logErr);
            }
        }

        return noStoreJson({ data });
    } catch (err) {
        console.error('[collection-tasks PATCH] unexpected error:', err);
        const message = err instanceof Error ? err.message : 'Internal server error';
        return noStoreJson({ error: message }, 500);
    }
}
