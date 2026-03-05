import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Only allow safe fields to be updated
        const allowed = ['last_contact_at', 'next_followup_at', 'status', 'note', 'owner', 'priority'];
        const update: Record<string, any> = {};
        for (const key of allowed) {
            if (key in body) update[key] = body[key];
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from('collection_tasks')
            .update(update)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[collection-tasks PATCH] error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (err: any) {
        console.error('[collection-tasks PATCH] unexpected error:', err);
        return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
    }
}
