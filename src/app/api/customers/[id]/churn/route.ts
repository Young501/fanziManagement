import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

async function getCurrentUserRole() {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return { user: null, role: null };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    return {
        user,
        role: profile?.role?.toLowerCase() || null,
    };
}

function canManageCustomers(role: string | null) {
    return role === 'admin' || role === 'manager';
}

function readString(body: Record<string, unknown>, key: string) {
    const value = body[key];
    return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { user, role } = await getCurrentUserRole();
        if (!user) return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });
        if (!canManageCustomers(role)) {
            return NextResponse.json({ error: '权限不足，仅管理员或经理可登记客户流失' }, { status: 403 });
        }

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: '缺失客户ID' }, { status: 400 });
        }

        const body = await request.json() as Record<string, unknown>;
        const churnType = readString(body, 'churn_type') || '未分类流失';
        const churnReason = readString(body, 'churn_reason');
        const churnDate = readString(body, 'churn_date');
        const lastServiceDate = readString(body, 'last_service_date');
        const note = readString(body, 'note') || readString(body, 'remarks');
        const competitorInfo = readString(body, 'competitor_info');
        const finalNote = [note, competitorInfo ? `竞品/去向：${competitorInfo}` : ''].filter(Boolean).join('\n');

        if (!churnReason) {
            return NextResponse.json({ error: '请填写流失核心原因' }, { status: 400 });
        }

        if (!churnDate || Number.isNaN(new Date(churnDate).getTime())) {
            return NextResponse.json({ error: '请选择有效的流失日期' }, { status: 400 });
        }

        if (lastServiceDate && Number.isNaN(new Date(lastServiceDate).getTime())) {
            return NextResponse.json({ error: '请选择有效的最后服务日期' }, { status: 400 });
        }

        const supabase = createAdminClient();

        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('id, company_name, customer_status')
            .eq('id', id)
            .maybeSingle();

        if (customerError) {
            return NextResponse.json({ error: customerError.message }, { status: 500 });
        }

        if (!customer) {
            return NextResponse.json({ error: '客户不存在' }, { status: 404 });
        }

        if (customer.customer_status === '流失') {
            return NextResponse.json({ error: '该客户已经是流失状态，请勿重复登记' }, { status: 409 });
        }

        const { data: churnLog, error: insertError } = await supabase
            .from('customer_churn_logs')
            .insert({
                customer_id: id,
                churn_type: churnType,
                churn_reason: churnReason,
                churn_date: churnDate,
                last_service_date: lastServiceDate || null,
                note: finalNote || null,
            })
            .select('id')
            .single();

        if (insertError || !churnLog) {
            console.error('[churn API] Insert log error:', insertError);
            return NextResponse.json({ error: insertError?.message || '保存流失记录失败' }, { status: 500 });
        }

        const warnings: string[] = [];

        const { error: deleteTasksError } = await supabase
            .from('collection_tasks')
            .delete()
            .eq('customer_id', id);

        if (deleteTasksError) {
            console.error('[churn API] Delete tasks error:', deleteTasksError);
            warnings.push(`流失已登记，但清理催款任务失败: ${deleteTasksError.message}`);
        }

        const { error: updateError } = await supabase
            .from('customers')
            .update({ customer_status: '流失' })
            .eq('id', id);

        if (updateError) {
            console.error('[churn API] Update customer status error:', updateError);
            await supabase.from('customer_churn_logs').delete().eq('id', churnLog.id);
            return NextResponse.json({ error: `流失登记失败，客户状态未更新: ${updateError.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true, warnings });
    } catch (err) {
        console.error('[churn API] Error:', err);
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
