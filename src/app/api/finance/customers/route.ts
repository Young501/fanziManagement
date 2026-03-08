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
                    service_manager,
                    customer_status
                ),
                payment_records (
                    paid_at,
                    paid_amount
                )
            `)
            .neq('customers.customer_status', '流失');

        if (search) {
            query = query.ilike('customers.company_name', `%${search}%`);
        }

        const { data: allData, error } = await query.order('payment_due_date', { ascending: false });

        if (error) {
            console.error('[finance customers API] error:', error);
            return noStoreJson({ error: error.message }, 500);
        }

        // Logic fix: Only show the LATEST company_receivables per customer
        const latestMap = new Map<string, any>();
        for (const item of allData || []) {
            const cid = item.customer_id;
            if (!cid) continue;
            // Since we ordered by payment_due_date desc, the first one we see is the "latest" (future ones first, or current if no future)
            // Wait, usually the latest is the one with the furthest due date.
            if (!latestMap.has(cid)) {
                latestMap.set(cid, item);
            } else {
                // If we already have one, check if this one is "later"
                const existing = latestMap.get(cid);
                const currentDue = new Date(item.payment_due_date).getTime();
                const existingDue = new Date(existing.payment_due_date).getTime();
                if (currentDue > existingDue) {
                    latestMap.set(cid, item);
                }
            }
        }

        let filteredData = Array.from(latestMap.values());

        // Ensure current_receipt_date/amount are populated from payment_records if missing
        filteredData = filteredData.map((item: any) => {
            if (!item.current_receipt_date && item.payment_records && item.payment_records.length > 0) {
                // Sort by paid_at desc to get the latest
                const latest = [...item.payment_records].sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())[0];
                return {
                    ...item,
                    current_receipt_date: latest.paid_at,
                    current_receipt_amount: latest.paid_amount,
                    // Keep payment_records small or remove it from the final response
                    payment_records: undefined
                };
            }
            return {
                ...item,
                payment_records: undefined
            };
        });

        // Apply status filter
        const now = Date.now();

        if (statusFilter) {
            filteredData = filteredData.filter((item: any) => {
                const status = String(item.status || 'unpaid').toLowerCase();
                const nowTs = now;
                const dueDateTs = item.payment_due_date ? new Date(item.payment_due_date).getTime() : 0;
                const isOverdue = dueDateTs < nowTs;

                // Requirement: Abolish the 45-day virtual unpaid logic.
                // We now trust the 'status' and 'payment_due_date' of the latest record.

                if (statusFilter === 'paid') {
                    return (status === 'paid' || status === 'pending');
                }

                if (statusFilter === 'overdue') {
                    return status !== 'paid' && status !== 'pending' && isOverdue;
                }

                // Filtering for 'unpaid'
                if (statusFilter === 'unpaid') {
                    // Just truly unpaid and NOT overdue
                    return status !== 'paid' && status !== 'pending' && !isOverdue;
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
