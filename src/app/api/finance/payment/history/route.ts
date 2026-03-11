import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

async function getRole() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    return profile?.role || null;
}

export async function GET(request: NextRequest) {
    try {
        const supabaseAuth = await createServerClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user) return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });

        const supabaseAdmin = createAdminClient();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const start = (page - 1) * limit;
        const month = searchParams.get('month') || ''; // format: YYYY-MM
        const paymentType = searchParams.get('paymentType') || ''; // 'regular' | 'adhoc'

        // Build base query (paginated)
        let query = supabaseAdmin
            .from('payment_records')
            .select('*, customers(company_name), company_receivables(billing_fee_month, pay_cycle_months, receipt_note)', { count: 'exact' })
            .order('paid_at', { ascending: false })
            .order('created_at', { ascending: false });

        // Apply month filter (paid_at is a date string)
        if (month) {
            const [year, mon] = month.split('-');
            const startDate = `${year}-${mon}-01`;
            const endYear = mon === '12' ? parseInt(year) + 1 : parseInt(year);
            const endMon = mon === '12' ? '01' : String(parseInt(mon) + 1).padStart(2, '0');
            const endDate = `${endYear}-${endMon}-01`;
            query = query.gte('paid_at', startDate).lt('paid_at', endDate);
        }

        // Apply payment type filter
        // 'regular' = has a receivable_id (linked to company_receivables)
        // 'adhoc'   = receivable_id is null
        if (paymentType === 'regular') {
            query = query.not('receivable_id', 'is', null);
        } else if (paymentType === 'adhoc') {
            query = query.is('receivable_id', null);
        }

        const { data, count, error } = await query.range(start, start + limit - 1);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Compute total sum for the filtered dataset (no pagination)
        let totalQuery = supabaseAdmin
            .from('payment_records')
            .select('paid_amount');

        if (month) {
            const [year, mon] = month.split('-');
            const startDate = `${year}-${mon}-01`;
            const endYear = mon === '12' ? parseInt(year) + 1 : parseInt(year);
            const endMon = mon === '12' ? '01' : String(parseInt(mon) + 1).padStart(2, '0');
            const endDate = `${endYear}-${endMon}-01`;
            totalQuery = totalQuery.gte('paid_at', startDate).lt('paid_at', endDate);
        }
        if (paymentType === 'regular') {
            totalQuery = totalQuery.not('receivable_id', 'is', null);
        } else if (paymentType === 'adhoc') {
            totalQuery = totalQuery.is('receivable_id', null);
        }

        const { data: totalData } = await totalQuery;
        const total = (totalData || []).reduce((sum, r) => sum + (r.paid_amount || 0), 0);

        const role = await getRole();

        return NextResponse.json({ data, count, role, total });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const role = await getRole();
        if (role?.toLowerCase() !== 'admin' && role?.toLowerCase() !== 'manager') {
            return NextResponse.json({ error: '权限不足，仅管理员或客户经理可删除' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: '缺失记录ID' }, { status: 400 });
        }
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID_RE.test(id)) {
            return NextResponse.json({ error: '无效的记录ID格式' }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Fetch the record first to revert receivable amount if applicable
        const { data: record } = await supabase.from('payment_records').select('*').eq('id', id).single();
        if (record) {
            const { data: receivable } = await supabase.from('company_receivables').select('amount_paid_period').eq('id', record.receivable_id).single();
            if (receivable) {
                const newPaid = Math.max(0, (receivable.amount_paid_period || 0) - record.paid_amount);
                await supabase.from('company_receivables').update({ amount_paid_period: newPaid }).eq('id', record.receivable_id);
            }
        }

        const { error } = await supabase
            .from('payment_records')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const role = await getRole();
        if (role?.toLowerCase() !== 'admin' && role?.toLowerCase() !== 'manager') {
            return NextResponse.json({ error: '权限不足，仅管理员或客户经理可修改' }, { status: 403 });
        }

        const body = await request.json();
        const { id, paid_at, paid_amount, method, negotiated_discount_amount, note } = body;

        if (!id) {
            return NextResponse.json({ error: '缺失记录ID' }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Fetch old record first to compute difference if paid_amount changes
        const { data: oldRecord, error: fetchError } = await supabase
            .from('payment_records')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !oldRecord) {
            return NextResponse.json({ error: fetchError?.message || '记录不存在' }, { status: 404 });
        }

        // Handle paid amount difference and receivable reconciliation
        if (typeof paid_amount === 'number' && paid_amount !== oldRecord.paid_amount && oldRecord.receivable_id) {
            const diff = paid_amount - oldRecord.paid_amount;
            const { data: receivable } = await supabase
                .from('company_receivables')
                .select('amount_paid_period')
                .eq('id', oldRecord.receivable_id)
                .single();

            if (receivable) {
                const newPaid = Math.max(0, (receivable.amount_paid_period || 0) + diff);
                await supabase
                    .from('company_receivables')
                    .update({ amount_paid_period: newPaid })
                    .eq('id', oldRecord.receivable_id);
            }
        }

        const updates: any = {};
        if (paid_at !== undefined) updates.paid_at = paid_at;
        if (paid_amount !== undefined) updates.paid_amount = paid_amount;
        if (method !== undefined) updates.method = method;
        if (negotiated_discount_amount !== undefined) updates.negotiated_discount_amount = negotiated_discount_amount;
        if (note !== undefined) updates.note = note;

        const { error: updateError } = await supabase
            .from('payment_records')
            .update(updates)
            .eq('id', id);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}
