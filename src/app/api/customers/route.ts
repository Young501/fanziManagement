import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';

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
        const search = sanitizeSearch(searchParams.get('search'));
        const serviceManager = sanitizeSearch(searchParams.get('service_manager'));

        const includeChurned = searchParams.get('include_churned') === 'true';
        const offset = (page - 1) * limit;

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return noStoreJson({ error: 'Unauthorized' }, 401);
        }

        let query = supabase.from('customers').select('*', { count: 'exact' });

        if (!includeChurned) {
            query = query.neq('customer_status', '流失');
        }

        if (search) {
            query = query.or(`company_name.ilike.%${search}%,contact_person.ilike.%${search}%`);
        }

        if (serviceManager) {
            query = query.eq('service_manager', serviceManager);
        }

        const { data, error, count } = await query
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[customers API] error:', error);
            return noStoreJson({ error: error.message, code: error.code }, 500);
        }

        return noStoreJson({
            data: data ?? [],
            total: count ?? 0,
            page,
            limit,
            totalPages: Math.ceil((count ?? 0) / limit),
        });
    } catch (err: any) {
        console.error('[customers API] unexpected error:', err);
        return noStoreJson({ error: err?.message ?? 'Internal server error' }, 500);
    }
}

