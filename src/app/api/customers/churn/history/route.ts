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
        const supabase = await createServerClient();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const start = (page - 1) * limit;

        const { data, count, error } = await supabase
            .from('customer_churn_logs')
            .select('*, customers(company_name)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(start, start + limit - 1);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const role = await getRole();

        return NextResponse.json({ data, count, role });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const role = await getRole();
        if (role !== 'admin') {
            return NextResponse.json({ error: '权限不足，仅管理员可删除' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: '缺失记录ID' }, { status: 400 });
        }

        const supabase = createAdminClient();
        const { error } = await supabase
            .from('customer_churn_logs')
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
