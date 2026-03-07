import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { churn_type, churn_reason, churn_date, last_service_date, note } = body;

        if (!id || !churn_type || !churn_reason || !churn_date) {
            return NextResponse.json({ error: 'Customer ID, type, reason, and date are required' }, { status: 400 });
        }

        const supabase = createAdminClient();

        // 1. Insert into customer_churn_logs
        const { error: insertError } = await supabase
            .from('customer_churn_logs')
            .insert({
                customer_id: id,
                churn_type,
                churn_reason,
                churn_date,
                last_service_date: last_service_date || null,
                note
            });

        if (insertError) {
            console.error('[churn API] Insert log error:', insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // 2. Update customer status to '流失'
        const { error: updateError } = await supabase
            .from('customers')
            .update({ customer_status: '流失' })
            .eq('id', id);

        if (updateError) {
            console.error('[churn API] Update customer status error:', updateError);
            // We logged the churn, but failed to update status. This is a partial success/failure state.
            return NextResponse.json({ error: '流失已登记，但更新客户状态失败' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[churn API] Error:', err);
        return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
    }
}
