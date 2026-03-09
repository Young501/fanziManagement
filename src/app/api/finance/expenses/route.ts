import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

function noStoreJson(body: unknown, status = 200) {
    return new NextResponse(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0',
        },
    });
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return noStoreJson({ error: '未授权，请先登录' }, 401);
        }

        const body = await request.json();

        const {
            customer_id,
            receivable_id,
            expense_date,
            expense_amount,
            expense_category,
            expense_type,
            vendor_name,
            payment_method,
            note,
            attachment,
        } = body;

        // Validate required fields
        if (!expense_date) {
            return noStoreJson({ error: '费用日期不能为空' }, 400);
        }
        if (!expense_amount || parseFloat(expense_amount) <= 0) {
            return noStoreJson({ error: '费用金额必须大于0' }, 400);
        }
        if (!expense_category) {
            return noStoreJson({ error: '费用类别不能为空' }, 400);
        }

        // Category whitelist
        const VALID_CATEGORIES = ['办公费', '交通费', '社保公积金', '工资', '税费', '外包服务费', '其他'];
        if (!VALID_CATEGORIES.includes(expense_category)) {
            return noStoreJson({ error: '无效的费用类别' }, 400);
        }

        // Input length limits
        if (vendor_name && String(vendor_name).length > 200) return noStoreJson({ error: '供应商名称过长' }, 400);
        if (expense_type && String(expense_type).length > 100) return noStoreJson({ error: '费用类型过长' }, 400);
        if (note && String(note).length > 1000) return noStoreJson({ error: '备注过长' }, 400);
        if (payment_method && String(payment_method).length > 50) return noStoreJson({ error: '付款方式长度超限' }, 400);

        // Attachment URL origin check
        if (attachment && !String(attachment).startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL!)) {
            return noStoreJson({ error: '无效的附件地址' }, 400);
        }

        const record = {
            customer_id: customer_id || null,
            receivable_id: receivable_id || null,
            expense_date,
            expense_amount: parseFloat(expense_amount),
            expense_category,
            expense_type: expense_type || null,
            vendor_name: vendor_name || null,
            payment_method: payment_method || null,
            note: note || null,
            attachment: attachment || null,
            created_by: user.id,
        };

        const supabaseAdmin = createAdminClient();

        const { data, error } = await supabaseAdmin
            .from('expense_records')
            .insert(record)
            .select()
            .single();

        if (error) {
            return noStoreJson({ error: error.message }, 500);
        }

        return noStoreJson({ data, success: true });
    } catch (err: any) {
        return noStoreJson({ error: err?.message || '服务器错误' }, 500);
    }
}
