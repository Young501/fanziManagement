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
        const month = searchParams.get('month') || ''; // format: YYYY-MM

        let batchData = null;
        let details: any[] = [];

        if (month) {
            const [year, mon] = month.split('-');
            const monthDate = `${year}-${mon}-01`;

            // Fetch batch for the given month
            const { data: batch } = await supabaseAdmin
                .from('dividend_batches')
                .select('*')
                .eq('dividend_month', monthDate)
                .maybeSingle();

            if (batch) {
                batchData = batch;
                const { data: batchDetails } = await supabaseAdmin
                    .from('dividend_batch_details')
                    .select('*')
                    .eq('batch_id', batch.id)
                    .order('created_at', { ascending: true });
                details = batchDetails || [];
            }
        }

        // Fetch all historical batches (for the list view)
        const { data: allBatches } = await supabaseAdmin
            .from('dividend_batches')
            .select('*')
            .order('dividend_month', { ascending: false });

        // Fetch all historical batch details with their month for stats calculation
        const { data: allDetails } = await supabaseAdmin
            .from('dividend_batch_details')
            .select(`
                shareholder_name,
                dividend_amount,
                dividend_batches!inner(dividend_month)
            `);

        return NextResponse.json({
            batch: batchData,
            details,
            allBatches: allBatches || [],
            allDetails: allDetails || []
        });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const role = await getRole();
        if (role?.toLowerCase() !== 'admin' && role?.toLowerCase() !== 'manager') {
            return NextResponse.json({ error: '权限不足，仅管理员或客户经理可操作' }, { status: 403 });
        }

        const supabaseAuth = await createServerClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 });

        const body = await request.json();
        const {
            dividend_month, // YYYY-MM
            based_on_revenue,
            based_on_cost,
            based_on_profit,
            total_dividend_amount,
            note,
            details, // [{ shareholder_name, ratio, dividend_amount }]
        } = body;

        if (!dividend_month || !details || details.length !== 3) {
            return NextResponse.json({ error: '参数不完整' }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient();

        // Convert YYYY-MM to YYYY-MM-01
        const [year, mon] = dividend_month.split('-');
        const monthDate = `${year}-${mon}-01`;

        // Check if batch already exists
        const { data: existing } = await supabaseAdmin
            .from('dividend_batches')
            .select('id')
            .eq('dividend_month', monthDate)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: '该月份分红已存在，不可重复创建' }, { status: 409 });
        }

        // Fetch profile name
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
        const createdBy = profile?.full_name || user.email || 'unknown';

        // Insert batch
        const { data: batch, error: batchError } = await supabaseAdmin
            .from('dividend_batches')
            .insert({
                dividend_month: monthDate,
                based_on_revenue: Number(based_on_revenue) || 0,
                based_on_cost: Number(based_on_cost) || 0,
                based_on_profit: Number(based_on_profit) || 0,
                total_dividend_amount: Number(total_dividend_amount) || 0,
                status: 'confirmed',
                note: note || null,
                created_by: createdBy,
            })
            .select()
            .single();

        if (batchError) {
            return NextResponse.json({ error: batchError.message }, { status: 500 });
        }

        // Insert details
        const detailRows = details.map((d: any) => ({
            batch_id: batch.id,
            shareholder_name: d.shareholder_name,
            ratio: Number(d.ratio) || 0,
            dividend_amount: Number(d.dividend_amount) || 0,
            is_paid: true,
            paid_at: monthDate,
            note: d.note || null,
        }));

        const { error: detailsError } = await supabaseAdmin
            .from('dividend_batch_details')
            .insert(detailRows);

        if (detailsError) {
            return NextResponse.json({ error: detailsError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, batchId: batch.id });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}
