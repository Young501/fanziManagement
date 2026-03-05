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
        const customerId = searchParams.get('customer_id') ?? '';

        if (!customerId) {
            return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
        }

        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('company_receivables')
            .select('*')
            .eq('customer_id', customerId)
            .order('payment_due_date', { ascending: true });

        if (error) {
            console.error('[payment receivables API] error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Sort: unpaid/overdue first, paid last
        const now = new Date().getTime();
        const sorted = (data || []).sort((a: any, b: any) => {
            const aRemaining = Number(a.amount_payable_period || 0) - Number(a.amount_paid_period || 0);
            const bRemaining = Number(b.amount_payable_period || 0) - Number(b.amount_paid_period || 0);
            const aOverdue = a.payment_due_date ? new Date(a.payment_due_date).getTime() < now : false;
            const bOverdue = b.payment_due_date ? new Date(b.payment_due_date).getTime() < now : false;

            // Overdue + unpaid first
            if (aRemaining > 0 && aOverdue && !(bRemaining > 0 && bOverdue)) return -1;
            if (bRemaining > 0 && bOverdue && !(aRemaining > 0 && aOverdue)) return 1;
            // Then unpaid
            if (aRemaining > 0 && bRemaining <= 0) return -1;
            if (bRemaining > 0 && aRemaining <= 0) return 1;
            // Then by due date
            return new Date(a.payment_due_date).getTime() - new Date(b.payment_due_date).getTime();
        });

        return NextResponse.json({ data: sorted });
    } catch (err: any) {
        console.error('[payment receivables API] unexpected error:', err);
        return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
    }
}
