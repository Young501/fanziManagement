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

function parseShareRatio(value: unknown) {
    if (value === null || value === undefined || value === '') return null;

    const ratio = Number(value);
    if (!Number.isFinite(ratio) || ratio < 0 || ratio > 100) {
        throw new Error('股东持股比例必须在 0 到 100 之间');
    }

    return ratio;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { user } = await getCurrentUserRole();
        if (!user) return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Missing customer ID' }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Fetch customer basic info
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (customerError) {
            return NextResponse.json({ error: customerError.message }, { status: 500 });
        }

        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Fetch company profile (if exists)
        const { data: companyProfile } = await supabase
            .from('customer_company_profiles')
            .select('*')
            .eq('customer_id', id)
            .maybeSingle();

        // Fetch shareholders
        const { data: shareholders } = await supabase
            .from('customer_shareholders')
            .select('*')
            .eq('customer_id', id);

        // Return the full company profile without restrictive mapping so the frontend can access all fields
        const normalizedCompanyProfile = companyProfile || null;

        const normalizedShareholders = shareholders || [];

        // Fetch contracts
        const { data: contracts } = await supabase
            .from('customer_contracts')
            .select('*')
            .eq('customer_id', id)
            .order('created_at', { ascending: false });

        return NextResponse.json({
            customer,
            companyProfile: normalizedCompanyProfile,
            shareholders: normalizedShareholders,
            contracts: contracts || []
        });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { user, role } = await getCurrentUserRole();
        if (!user) return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });
        if (!canManageCustomers(role)) {
            return NextResponse.json({ error: '权限不足，仅管理员或经理可修改客户档案' }, { status: 403 });
        }

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Missing customer ID' }, { status: 400 });
        }

        const body = await request.json();
        const {
            company_name,
            contact_person,
            contact_info,
            website_member,
            address,
            customer_status,
            source_info,
            source_remark,
            service_manager,
            companyProfile,
            shareholder,
            deleteShareholderId
        } = body;

        const supabase = createAdminClient();
        const hasBasicCustomerUpdate = [
            'company_name',
            'contact_person',
            'contact_info',
            'website_member',
            'address',
            'customer_status',
            'source_info',
            'source_remark',
            'service_manager',
        ].some((key) => Object.prototype.hasOwnProperty.call(body, key));

        // 1. Delete Shareholder
        if (deleteShareholderId) {
            const { error: deleteError } = await supabase
                .from('customer_shareholders')
                .delete()
                .eq('id', deleteShareholderId)
                .eq('customer_id', id);

            if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
            return NextResponse.json({ success: true });
        }

        // 2. Upsert Shareholder
        if (shareholder) {
            const shareholderName = String(shareholder.name || '').trim();
            if (!shareholderName) {
                return NextResponse.json({ error: '请填写股东姓名' }, { status: 400 });
            }

            let shareRatio: number | null;
            try {
                shareRatio = parseShareRatio(shareholder.share_ratio);
            } catch (err) {
                const message = err instanceof Error ? err.message : '股东信息不正确';
                return NextResponse.json({ error: message }, { status: 400 });
            }

            if (shareholder.id) {
                // Update existing
                const { error: updateShError } = await supabase
                    .from('customer_shareholders')
                    .update({
                        name: shareholderName,
                        share_ratio: shareRatio,
                        contact_number: shareholder.contact_number || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', shareholder.id)
                    .eq('customer_id', id);
                if (updateShError) return NextResponse.json({ error: updateShError.message }, { status: 500 });
            } else {
                // Insert new
                const { error: insertShError } = await supabase
                    .from('customer_shareholders')
                    .insert({
                        customer_id: id,
                        name: shareholderName,
                        share_ratio: shareRatio,
                        contact_number: shareholder.contact_number || null
                    });
                if (insertShError) return NextResponse.json({ error: insertShError.message }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        // 3. Upsert Company Profile
        if (companyProfile) {
            if (typeof companyProfile !== 'object' || Array.isArray(companyProfile)) {
                return NextResponse.json({ error: '公司画像数据格式不正确' }, { status: 400 });
            }

            // Because customer_id is the foreign key and likely unique (1:1), 
            // we first check if the profile exists to decide update vs insert
            const { data: existingProfile } = await supabase
                .from('customer_company_profiles')
                .select('id')
                .eq('customer_id', id)
                .maybeSingle();

            const profileData = { ...companyProfile };
            delete profileData.id; // ensure we don't accidentally insert/update ID if not meant to
            delete profileData.customer_id;

            if (existingProfile) {
                const { error: updateProfileError } = await supabase
                    .from('customer_company_profiles')
                    .update(profileData)
                    .eq('customer_id', id);
                if (updateProfileError) return NextResponse.json({ error: updateProfileError.message }, { status: 500 });
            } else {
                profileData.customer_id = id;
                const { error: insertProfileError } = await supabase
                    .from('customer_company_profiles')
                    .insert(profileData);
                if (insertProfileError) return NextResponse.json({ error: insertProfileError.message }, { status: 500 });
            }
            if (!hasBasicCustomerUpdate) {
                return NextResponse.json({ success: true });
            }
        }

        // 4. Update basic customer info
        const nextCompanyName = typeof company_name === 'string' ? company_name.trim() : '';
        const nextContactPerson = typeof contact_person === 'string' ? contact_person.trim() : '';

        if (!nextCompanyName || !nextContactPerson) {
            return NextResponse.json({ error: '企业名称和联系人不能为空' }, { status: 400 });
        }

        if (customer_status === '流失') {
            return NextResponse.json({ error: '请通过流失客户登记流程记录流失原因，不能直接把客户改为流失状态' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('customers')
            .update({
                company_name: nextCompanyName,
                contact_person: nextContactPerson,
                contact_info,
                website_member,
                address,
                customer_status,
                source_info,
                source_remark: source_remark || null,
                service_manager
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { user, role } = await getCurrentUserRole();
        if (!user) return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });
        if (role !== 'admin') {
            return NextResponse.json({ error: '权限不足，仅管理员可删除客户档案' }, { status: 403 });
        }

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Missing customer ID' }, { status: 400 });
        }

        const supabase = createAdminClient();

        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('id, company_name')
            .eq('id', id)
            .maybeSingle();

        if (customerError) {
            return NextResponse.json({ error: customerError.message }, { status: 500 });
        }

        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const { data: contracts, error: contractsError } = await supabase
            .from('customer_contracts')
            .select('id')
            .eq('customer_id', id);

        if (contractsError) {
            return NextResponse.json({ error: contractsError.message }, { status: 500 });
        }

        const contractIds = (contracts || []).map(contract => contract.id).filter(Boolean);

        if (contractIds.length > 0) {
            const { error } = await supabase
                .from('customer_contract_files')
                .delete()
                .in('contract_id', contractIds);

            if (error) {
                return NextResponse.json({ error: `删除合同附件失败: ${error.message}` }, { status: 500 });
            }
        }

        const deleteSteps = [
            { table: 'collection_tasks', message: '删除催款任务失败' },
            { table: 'payment_records', message: '删除收款记录失败' },
            { table: 'expense_records', message: '删除成本记录失败' },
            { table: 'customer_ad_hoc_services', message: '删除临时服务记录失败' },
            { table: 'company_receivables', message: '删除应收账单失败' },
            { table: 'customer_shareholders', message: '删除股东信息失败' },
            { table: 'customer_company_profiles', message: '删除公司画像失败' },
            { table: 'customer_churn_logs', message: '删除流失记录失败' },
            { table: 'customer_contracts', message: '删除合同记录失败' },
        ] as const;

        for (const step of deleteSteps) {
            const { error } = await supabase
                .from(step.table)
                .delete()
                .eq('customer_id', id);

            if (error) {
                return NextResponse.json({ error: `${step.message}: ${error.message}` }, { status: 500 });
            }
        }

        const { error: deleteCustomerError } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

        if (deleteCustomerError) {
            return NextResponse.json({ error: `删除客户档案失败: ${deleteCustomerError.message}` }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            company_name: customer.company_name,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}

