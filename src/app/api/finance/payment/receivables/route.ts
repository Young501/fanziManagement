import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
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
        const customerId = (searchParams.get('customer_id') ?? '').trim();

        if (!customerId || customerId.length > 64) {
            return noStoreJson({ error: 'customer_id is required' }, 400);
        }

        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('company_receivables')
            .select('*')
            .eq('customer_id', customerId)
            .order('payment_due_date', { ascending: true });

        if (error) {
            console.error('[payment receivables API] error:', error);
            return noStoreJson({ error: error.message }, 500);
        }

        const now = Date.now();
        const sorted = (data || []).sort((a: any, b: any) => {
            const aRemaining = Number(a.amount_payable_period || 0) - Number(a.amount_paid_period || 0);
            const bRemaining = Number(b.amount_payable_period || 0) - Number(b.amount_paid_period || 0);
            const aOverdue = a.payment_due_date ? new Date(a.payment_due_date).getTime() < now : false;
            const bOverdue = b.payment_due_date ? new Date(b.payment_due_date).getTime() < now : false;

            if (aRemaining > 0 && aOverdue && !(bRemaining > 0 && bOverdue)) return -1;
            if (bRemaining > 0 && bOverdue && !(aRemaining > 0 && aOverdue)) return 1;
            if (aRemaining > 0 && bRemaining <= 0) return -1;
            if (bRemaining > 0 && aRemaining <= 0) return 1;
            return new Date(a.payment_due_date).getTime() - new Date(b.payment_due_date).getTime();
        });

        return noStoreJson({ data: sorted });
    } catch (err: any) {
        console.error('[payment receivables API] unexpected error:', err);
        return noStoreJson({ error: err?.message ?? 'Internal server error' }, 500);
    }
}
