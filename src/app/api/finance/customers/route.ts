import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

type FinanceStatusFilter = 'paid' | 'overdue' | 'unpaid' | null;

function toPositiveInt(value: string | null, fallback: number) {
    const n = Number.parseInt(value ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sanitizeSearch(value: string | null) {
    return (value ?? '').trim().slice(0, 50).replace(/[,%()]/g, '');
}

function detectStatusFilter(raw: string): FinanceStatusFilter {
    const s = raw.toLowerCase();
    if (!s) return null;
    if (s.includes('overdue') || s.includes('逾期') || s.includes('宸查')) return 'overdue';
    if (s.includes('paid') || s.includes('付清') || s.includes('宸蹭')) return 'paid';
    if (s.includes('unpaid') || s.includes('未付') || s.includes('鏈粯')) return 'unpaid';
    return null;
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
        const page = toPositiveInt(searchParams.get('page'), 1);
        const limit = Math.min(toPositiveInt(searchParams.get('limit'), DEFAULT_LIMIT), MAX_LIMIT);
        const search = sanitizeSearch(searchParams.get('search'));
        const statusFilter = detectStatusFilter(sanitizeSearch(searchParams.get('status')));
        const offset = (page - 1) * limit;

        const supabase = createAdminClient();

        let query = supabase
            .from('company_receivables')
            .select(`
                *,
                customers!inner (
                    id,
                    company_name,
                    contact_person,
                    contact_info,
                    service_manager
                )
            `);

        if (search) {
            query = query.ilike('customers.company_name', `%${search}%`);
        }

        const { data: allData, error } = await query.order('payment_due_date', { ascending: true });

        if (error) {
            console.error('[finance customers API] error:', error);
            return noStoreJson({ error: error.message }, 500);
        }

        let filteredData = allData || [];

        // Fetch payment records to calculate true paid amount
        const recIds = filteredData.map(r => r.id);
        const { data: allPayments } = await supabase
            .from('payment_records')
            .select('receivable_id, paid_amount')
            .in('receivable_id', recIds);

        const paymentMap: Record<string, number> = {};
        allPayments?.forEach(p => {
            paymentMap[p.receivable_id] = (paymentMap[p.receivable_id] || 0) + Number(p.paid_amount || 0);
        });

        // Map and apply status filter
        const now = Date.now();
        filteredData = filteredData.map((item: any) => {
            const sumPaid = paymentMap[item.id] || 0;
            const status = String(item.status || 'unpaid').toLowerCase();
            const isActuallyPaid = status === 'paid';
            const isPending = status === 'pending';

            // Requirement: 
            // 1. If paid but no record, default to payable amount
            // 2. If PENDING (renewed), show the LAST RECEIPT amount so it doesn't look empty
            let effectivePaid = sumPaid;
            if (isActuallyPaid) {
                effectivePaid = sumPaid > 0 ? sumPaid : Number(item.amount_payable_period || 0);
            } else if (isPending && sumPaid === 0) {
                effectivePaid = Number(item.current_receipt_amount || 0);
            }

            return {
                ...item,
                amount_paid_period: effectivePaid
            };
        });

        if (statusFilter) {
            filteredData = filteredData.filter((item: any) => {
                const status = String(item.status || 'unpaid').toLowerCase();
                const nowTs = now;
                const dueDateTs = item.payment_due_date ? new Date(item.payment_due_date).getTime() : 0;
                const isOverdue = dueDateTs < nowTs;

                // Logic: 
                // A "Paid" record within 45 days of its next due date is virtually "Unpaid" for collection.
                const isWithin45Days = dueDateTs > 0 && (dueDateTs - nowTs) <= (45 * 24 * 60 * 60 * 1000);
                const isVirtuallyUnpaid = (status === 'paid' || status === 'pending') && isWithin45Days;

                if (statusFilter === 'paid') {
                    // Only show truly paid records that are NOT within 45 days of next due date
                    return (status === 'paid' || status === 'pending') && !isWithin45Days;
                }

                if (statusFilter === 'overdue') {
                    // Overdue still means truly unpaid and past due date
                    return status !== 'paid' && status !== 'pending' && isOverdue;
                }

                // Filtering for 'unpaid'
                if (statusFilter === 'unpaid') {
                    // Include truly unpaid (not overdue) OR virtually unpaid (paid but soon expires)
                    const isTrulyUnpaidNotOverdue = status !== 'paid' && status !== 'pending' && !isOverdue;
                    return isTrulyUnpaidNotOverdue || isVirtuallyUnpaid;
                }

                return true;
            });
        }

        const total = filteredData.length;
        const paginatedData = filteredData.slice(offset, offset + limit);

        return noStoreJson({
            data: paginatedData,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err: any) {
        console.error('[finance customers API] unexpected error:', err);
        return noStoreJson({ error: err?.message ?? 'Internal server error' }, 500);
    }
}
