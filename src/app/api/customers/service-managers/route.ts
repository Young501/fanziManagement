import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function GET() {
    try {
        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('customers')
            .select('service_manager')
            .not('service_manager', 'is', null)
            .order('service_manager', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Deduplicate
        const unique = [...new Set((data ?? []).map((r: any) => r.service_manager).filter(Boolean))];

        return NextResponse.json({ data: unique });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
    }
}
