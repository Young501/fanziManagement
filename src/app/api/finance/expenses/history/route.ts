import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { isValidExpenseCategory, normalizeExpenseCategory } from '@/lib/expense-categories';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        const limit = parseInt(searchParams.get('limit') || '10');
        const start = (page - 1) * limit;
        const month = searchParams.get('month') || ''; // format: YYYY-MM
        const category = searchParams.get('category') || '';
        const method = searchParams.get('method') || '';

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

        // Apply payment method filter
        if (method) {
            query = query.eq('payment_method', method);
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
        if (method) {
            totalQuery = totalQuery.eq('payment_method', method);
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
        if (!UUID_RE.test(String(id))) {
            return NextResponse.json({ error: '无效的记录ID格式' }, { status: 400 });
        }

        const supabase = createAdminClient();

        const updates: any = {};
        if (expense_date !== undefined) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(expense_date)) || Number.isNaN(new Date(`${expense_date}T00:00:00`).getTime())) {
                return NextResponse.json({ error: '费用日期不正确' }, { status: 400 });
            }
            updates.expense_date = expense_date;
        }
        if (expense_amount !== undefined) {
            const amount = Number(expense_amount);
            if (!Number.isFinite(amount) || amount <= 0) {
                return NextResponse.json({ error: '费用金额必须大于0' }, { status: 400 });
            }
            updates.expense_amount = amount;
        }
        if (expense_category !== undefined) {
            const normalizedCategory = normalizeExpenseCategory(expense_category);
            if (!isValidExpenseCategory(normalizedCategory)) {
                return NextResponse.json({ error: '无效的费用类别' }, { status: 400 });
            }
            updates.expense_category = normalizedCategory;
        }
        if (expense_type !== undefined) {
            if (String(expense_type).length > 100) return NextResponse.json({ error: '费用类型过长' }, { status: 400 });
            updates.expense_type = expense_type || null;
        }
        if (vendor_name !== undefined) {
            if (String(vendor_name).length > 200) return NextResponse.json({ error: '供应商名称过长' }, { status: 400 });
            updates.vendor_name = vendor_name || null;
        }
        if (payment_method !== undefined) {
            if (String(payment_method).length > 50) return NextResponse.json({ error: '付款方式长度超限' }, { status: 400 });
            updates.payment_method = payment_method || null;
        }
        if (note !== undefined) {
            if (String(note).length > 1000) return NextResponse.json({ error: '备注过长' }, { status: 400 });
            updates.note = note || null;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
        }

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
