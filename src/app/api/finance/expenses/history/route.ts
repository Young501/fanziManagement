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
        const category = searchParams.get('category') || '';

        // Build base query (paginated)
        let query = supabaseAdmin
            .from('expense_records')
            .select('*, customers(company_name)', { count: 'exact' })
            .order('expense_date', { ascending: false })
            .order('created_at', { ascending: false });

        // Apply month filter
        if (month) {
            const [year, mon] = month.split('-');
            const startDate = `${year}-${mon}-01`;
            const endYear = mon === '12' ? parseInt(year) + 1 : parseInt(year);
            const endMon = mon === '12' ? '01' : String(parseInt(mon) + 1).padStart(2, '0');
            const endDate = `${endYear}-${endMon}-01`;
            query = query.gte('expense_date', startDate).lt('expense_date', endDate);
        }

        // Apply category filter
        if (category) {
            query = query.eq('expense_category', category);
        }

        const { data, count, error } = await query.range(start, start + limit - 1);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Compute total sum for the filtered dataset (no pagination)
        let totalQuery = supabaseAdmin
            .from('expense_records')
            .select('expense_amount');

        if (month) {
            const [year, mon] = month.split('-');
            const startDate = `${year}-${mon}-01`;
            const endYear = mon === '12' ? parseInt(year) + 1 : parseInt(year);
            const endMon = mon === '12' ? '01' : String(parseInt(mon) + 1).padStart(2, '0');
            const endDate = `${endYear}-${endMon}-01`;
            totalQuery = totalQuery.gte('expense_date', startDate).lt('expense_date', endDate);
        }
        if (category) {
            totalQuery = totalQuery.eq('expense_category', category);
        }

        const { data: totalData } = await totalQuery;
        const total = (totalData || []).reduce((sum, r) => sum + (r.expense_amount || 0), 0);

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

        const { error } = await supabase
            .from('expense_records')
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
        const {
            id,
            expense_date,
            expense_amount,
            expense_category,
            expense_type,
            vendor_name,
            payment_method,
            note
        } = body;

        if (!id) {
            return NextResponse.json({ error: '缺失记录ID' }, { status: 400 });
        }

        const supabase = createAdminClient();

        const updates: any = {};
        if (expense_date !== undefined) updates.expense_date = expense_date;
        if (expense_amount !== undefined) updates.expense_amount = parseFloat(expense_amount);
        if (expense_category !== undefined) updates.expense_category = expense_category;
        if (expense_type !== undefined) updates.expense_type = expense_type;
        if (vendor_name !== undefined) updates.vendor_name = vendor_name;
        if (payment_method !== undefined) updates.payment_method = payment_method;
        if (note !== undefined) updates.note = note;

        const { error } = await supabase
            .from('expense_records')
            .update(updates)
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}
