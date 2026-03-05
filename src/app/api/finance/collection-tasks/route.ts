import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tab = searchParams.get('tab') ?? 'due_this_month'; // 'due_this_month' | 'overdue'
        const page = parseInt(searchParams.get('page') ?? '1', 10);
        const limit = parseInt(searchParams.get('limit') ?? '20', 10);
        const offset = (page - 1) * limit;

        const supabase = createAdminClient();
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthStart = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;

        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const monthEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

        // Fetch all open tasks with their receivable and customer data
        const { data: allTasks, error } = await supabase
            .from('collection_tasks')
            .select(`
                id,
                created_at,
                customer_id,
                receivable_id,
                priority,
                status,
                target_amount,
                due_date,
                next_followup_at,
                owner,
                last_contact_at,
                note,
                company_receivables (
                    payment_due_date,
                    amount_payable_period,
                    amount_paid_period,
                    billing_fee_month,
                    pay_cycle_months,
                    has_contract,
                    contract_end_date,
                    receipt_note
                ),
                customers (
                    id,
                    company_name,
                    contact_person,
                    contact_info,
                    service_manager
                )
            `)
            .in('status', ['open', 'in_progress', 'promised']);

        if (error) {
            console.error('[collection-tasks GET] error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Enrich and filter
        const enriched = (allTasks || []).map((task: any) => {
            const rec = task.company_receivables ?? {};
            const paid = Number(rec.amount_paid_period || 0);
            const payable = Number(rec.amount_payable_period || 0);
            const uncollected_amount = Math.max(0, payable - paid);
            const dueDate = rec.payment_due_date ?? task.due_date;
            const isOverdue = dueDate && dueDate < monthStart;
            const overdue_days = isOverdue
                ? Math.floor((today.getTime() - new Date(dueDate).getTime()) / 86400000)
                : 0;
            const days_until_due = !isOverdue && dueDate
                ? Math.ceil((new Date(dueDate).getTime() - today.getTime()) / 86400000)
                : null;

            return {
                ...task,
                uncollected_amount,
                overdue_days,
                days_until_due,
                is_overdue: !!isOverdue,
                receivable_due_date: dueDate,
            };
        }).filter((task: any) => task.uncollected_amount > 0); // only open / unpaid

        // Tab filter
        let filtered: any[];
        if (tab === 'overdue') {
            filtered = enriched.filter((t: any) => t.is_overdue);
            // Sort: overdue_days desc, then priority asc (P0 < P1 < P2)
            filtered.sort((a: any, b: any) => {
                if (b.overdue_days !== a.overdue_days) return b.overdue_days - a.overdue_days;
                return (a.priority ?? 'P2').localeCompare(b.priority ?? 'P2');
            });
        } else {
            // due_this_month: due_date falls anywhere in the current calendar month
            filtered = enriched.filter((t: any) =>
                t.receivable_due_date >= monthStart &&
                t.receivable_due_date <= monthEnd
            );
            // Sort: days_until_due asc, then priority asc
            filtered.sort((a: any, b: any) => {
                const da = a.days_until_due ?? 999;
                const db = b.days_until_due ?? 999;
                if (da !== db) return da - db;
                return (a.priority ?? 'P2').localeCompare(b.priority ?? 'P2');
            });
        }

        const total = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);

        return NextResponse.json({
            data: paginated,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err: any) {
        console.error('[collection-tasks GET] unexpected error:', err);
        return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
    }
}
