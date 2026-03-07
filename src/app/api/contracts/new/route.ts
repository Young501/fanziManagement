import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            customer_id,
            contract_no,
            contract_name,
            contract_type,
            sign_date,
            effective_date,
            start_date,
            end_date,
            status,
            auto_renew,
            pay_cycle_months,
            billing_fee_month,
            standard_price,
            discount_amount,
            deposit_amount,
            total_contract_amount,
            invoice_rule,
            remark,
            previous_contract_id,
            is_current
        } = body;

        if (!customer_id || !contract_no || !contract_name || total_contract_amount === undefined) {
            return NextResponse.json({ error: 'Missing required contract fields' }, { status: 400 });
        }

        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('customer_contracts')
            .insert({
                customer_id,
                contract_no,
                contract_name,
                contract_type: contract_type || '一般合同',
                sign_date: sign_date || null,
                effective_date: effective_date || null,
                start_date: start_date || null,
                end_date: end_date || null,
                status: status || '执行中',
                auto_renew: auto_renew || false,
                pay_cycle_months: pay_cycle_months ? parseInt(pay_cycle_months, 10) : null,
                billing_fee_month: billing_fee_month || null,
                standard_price: standard_price ? parseFloat(standard_price) : 0,
                discount_amount: discount_amount ? parseFloat(discount_amount) : 0,
                deposit_amount: deposit_amount ? parseFloat(deposit_amount) : 0,
                total_contract_amount: parseFloat(total_contract_amount),
                invoice_rule: invoice_rule || null,
                remark: remark || null,
                previous_contract_id: previous_contract_id || null,
                is_current: is_current !== undefined ? is_current : true
            })
            .select('*')
            .single();

        if (error) {
            console.error('[contracts/new API] Insert error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err: any) {
        console.error('[contracts/new API] Server Error:', err);
        return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
    }
}
