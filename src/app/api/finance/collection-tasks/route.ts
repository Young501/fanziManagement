import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function toPositiveInt(value: string | null, fallback: number) {
    const n = Number.parseInt(value ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function noStoreJson(body: unknown, status = 200) {
    return NextResponse.json(body, {
        status,
        headers: { 'Cache-Control': 'no-store' },
    });
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tab = (searchParams.get('tab') ?? 'due_this_month').trim();
        const page = toPositiveInt(searchParams.get('page'), 1);
        const limit = Math.min(toPositiveInt(searchParams.get('limit'), DEFAULT_LIMIT), MAX_LIMIT);
        const offset = (page - 1) * limit;

        const supabase = createAdminClient();
        const today = new Date();

        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthStart = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;

        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const monthEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

        const { count } = await supabase
            .from('collection_tasks_view')
            .select('*', { count: 'exact', head: true })
            .gt('uncollected_amount', 0)
            .eq(tab === 'overdue' ? 'is_overdue' : 'is_overdue', tab === 'overdue' ? true : false)
            .gte(tab === 'due_this_month' ? 'receivable_due_date' : 'id', tab === 'due_this_month' ? monthStart : '00000000-0000-0000-0000-000000000000')
            .lte(tab === 'due_this_month' ? 'receivable_due_date' : 'id', tab === 'due_this_month' ? monthEnd : 'ffffffff-ffff-ffff-ffff-ffffffffffff');

        let query = supabase
            .from('collection_tasks_view')
            .select('*')
            .gt('uncollected_amount', 0);

        if (tab === 'overdue') {
            query = query.eq('is_overdue', true);
            // Sorting for overdue: overdue_days DESC, then priority ASC
            // overdue_days is calculated in the view or here?
            // Actually, we can fetch all filtered and calculate overdue_days to sort, or just sort by receivable_due_date ASC
            query = query.order('receivable_due_date', { ascending: true }).order('priority', { ascending: true });
        } else {
            query = query
                .eq('is_overdue', false)
                .gte('receivable_due_date', monthStart)
                .lte('receivable_due_date', monthEnd);
            query = query.order('receivable_due_date', { ascending: true }).order('priority', { ascending: true });
        }

        const { data: rawTasks, error } = await query.range(offset, offset + limit - 1);

        if (error) {
            console.error('[collection-tasks GET] error:', error);
            return noStoreJson({ error: error.message }, 500);
        }

        // Reconstruct the expected nested structure for the frontend
        const paginated = (rawTasks || []).map((task: any) => {
            const isOverdue = !!task.is_overdue;
            const dueDate = task.receivable_due_date;
            const overdue_days = isOverdue && dueDate
                ? Math.floor((today.getTime() - new Date(dueDate).getTime()) / 86400000)
                : 0;
            const days_until_due = !isOverdue && dueDate
                ? Math.ceil((new Date(dueDate).getTime() - today.getTime()) / 86400000)
                : null;

            return {
                id: task.id,
                created_at: task.created_at,
                customer_id: task.customer_id,
                receivable_id: task.receivable_id,
                priority: task.priority,
                status: task.status,
                target_amount: task.target_amount,
                due_date: task.due_date,
                next_followup_at: task.next_followup_at,
                owner: task.owner,
                last_contact_at: task.last_contact_at,
                note: task.note,
                uncollected_amount: Number(task.uncollected_amount),
                overdue_days,
                days_until_due,
                is_overdue: isOverdue,
                receivable_due_date: dueDate,
                customers: {
                    id: task.customer_id,
                    company_name: task.company_name,
                    contact_person: task.contact_person,
                    contact_info: task.contact_info,
                    service_manager: task.service_manager,
                    customer_status: task.customer_status
                },
                company_receivables: task.receivable_id ? {
                    payment_due_date: task.payment_due_date,
                    amount_payable_period: task.amount_payable_period,
                    amount_paid_period: task.amount_paid_period,
                    billing_fee_month: task.billing_fee_month,
                    pay_cycle_months: task.pay_cycle_months,
                    has_contract: task.has_contract,
                    contract_end_date: task.contract_end_date,
                    receipt_note: task.receipt_note
                } : null
            };
        });

        const total = count ?? 0;

        return noStoreJson({
            data: paginated,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err: any) {
        console.error('[collection-tasks GET] unexpected error:', err);
        return noStoreJson({ error: err?.message ?? 'Internal server error' }, 500);
    }
}
