import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Use service role key to bypass RLS — safe for server-only API routes
function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') ?? '1', 10);
        const limit = parseInt(searchParams.get('limit') ?? '10', 10);
        const search = searchParams.get('search') ?? '';
        const serviceManager = searchParams.get('service_manager') ?? '';

        const offset = (page - 1) * limit;
        const supabase = createAdminClient();

        let query = supabase
            .from('customers')
            .select('*', { count: 'exact' });

        // Full-text search across company_name and contact_person
        if (search.trim()) {
            query = query.or(
                `company_name.ilike.%${search}%,contact_person.ilike.%${search}%`
            );
        }

        // Filter by service_manager (财务)
        if (serviceManager.trim()) {
            query = query.eq('service_manager', serviceManager);
        }

        // Pagination + ordering
        query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

        const { data, error, count } = await query;

        if (error) {
            console.error('[customers API] error:', error);
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: 500 }
            );
        }

        return NextResponse.json({
            data: data ?? [],
            total: count ?? 0,
            page,
            limit,
            totalPages: Math.ceil((count ?? 0) / limit),
        });
    } catch (err: any) {
        console.error('[customers API] unexpected error:', err);
        return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
    }
}
