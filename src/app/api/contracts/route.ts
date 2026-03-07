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

function toPositiveInt(value: string | null, fallback: number) {
    const n = Number.parseInt(value ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sanitizeSearch(value: string | null) {
    return (value ?? '')
        .trim()
        .slice(0, 50)
        .replace(/[,%()]/g, '');
}

function noStoreJson(body: unknown, status = 200) {
    return NextResponse.json(body, {
        status,
        headers: {
            'Cache-Control': 'no-store',
        },
    });
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = toPositiveInt(searchParams.get('page'), 1);
        const limit = Math.min(toPositiveInt(searchParams.get('limit'), DEFAULT_LIMIT), MAX_LIMIT);
        const search = sanitizeSearch(searchParams.get('search')).toLowerCase();

        const offset = (page - 1) * limit;
        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('customer_contracts')
            .select(
                `
                id,
                customer_id,
                contract_name,
                contract_no,
                total_contract_amount,
                start_date,
                end_date,
                status,
                sign_date,
                customers(company_name)
            `
            )
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[contracts API] Error:', error);
            return noStoreJson({ error: error.message }, 500);
        }

        const normalized = (data ?? []).map((c: any) => ({
            id: c.id,
            customer_id: c.customer_id,
            contract_name: c.contract_name,
            contract_number: c.contract_no ?? '',
            amount: Number(c.total_contract_amount ?? 0),
            start_date: c.start_date,
            end_date: c.end_date,
            status: c.status,
            signing_date: c.sign_date,
            customers: c.customers,
        }));

        const filtered = search
            ? normalized.filter((c) =>
                String(c.contract_name ?? '').toLowerCase().includes(search) ||
                String(c.contract_number ?? '').toLowerCase().includes(search) ||
                String(c.customers?.company_name ?? '').toLowerCase().includes(search)
            )
            : normalized;

        const total = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);

        return noStoreJson({
            data: paginated,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err: any) {
        console.error('[contracts API] exception:', err);
        return noStoreJson({ error: err?.message || 'Internal error' }, 500);
    }
}

