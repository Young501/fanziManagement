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
        const formData = await request.formData();

        const customerDataStr = formData.get('customerData');
        const contractDataStr = formData.get('contractData');
        const contractFile = formData.get('contract_file') as File | null;

        if (!customerDataStr || !contractDataStr) {
            return NextResponse.json({ error: 'Missing required firm data payload' }, { status: 400 });
        }

        const customerInfo = JSON.parse(customerDataStr as string);
        const contractInfo = JSON.parse(contractDataStr as string);

        const {
            company_name,
            company_code,
            unified_social_credit_code,
            industry,
            customer_type,
            contact_person,
            contact_info,
            website_member_name,
            customer_status,
            source_info,
            service_manager,
            address
        } = customerInfo;

        if (!company_name || !contact_person) {
            return NextResponse.json({ error: 'Company name and contact person are required' }, { status: 400 });
        }

        const supabase = createAdminClient();

        // 1. Insert Customer
        const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
                company_name,
                company_code,
                unified_social_credit_code,
                industry,
                customer_type,
                contact_person,
                contact_info,
                website_member_name,
                customer_status: customer_status || '正常',
                source_info,
                service_manager,
                address
            })
            .select('id')
            .single();

        if (customerError || !newCustomer) {
            console.error('[customers/new API] Insert error:', customerError);
            return NextResponse.json({ error: customerError?.message || 'Failed to create customer' }, { status: 500 });
        }

        const customerId = newCustomer.id;

        // 2. Prepare Contract/Pricing payload
        const {
            has_contract,
            standard_price,
            billing_fee_month,
            pay_cycle_months,
            effective_date,
            deposit_amount,
            contract_name,
            contract_no,
            sign_date
        } = contractInfo;

        let finalContractName = contract_name;
        if (!has_contract) {
            // Virtual implicit contract name
            finalContractName = `【无纸质合同】${company_name} - 首期默认服务设定`;
        } else if (!finalContractName) {
            finalContractName = `【系统生成】${company_name} 首签补充合同`;
        }

        // 3. Insert Contract
        const { data: newContract, error: contractError } = await supabase
            .from('customer_contracts')
            .insert({
                customer_id: customerId,
                contract_name: finalContractName,
                contract_no: contract_no || null,
                contract_type: has_contract ? '新签' : '无合同初始价格',
                sign_date: sign_date || null,
                effective_date: effective_date,
                start_date: effective_date, // Base the date off the entered effective date
                status: '执行中',
                is_current: true, // Mark it as the current active contract for financial processing
                pay_cycle_months: parseInt(pay_cycle_months || '0', 10),
                billing_fee_month: billing_fee_month ? parseFloat(billing_fee_month) : null,
                standard_price: standard_price ? parseFloat(standard_price) : 0,
                deposit_amount: deposit_amount ? parseFloat(deposit_amount) : 0,
                auto_renew: true
            })
            .select('id')
            .single();

        if (contractError) {
            console.error('[customers/new API] Contract Insert error:', contractError);
            // Optionally decide if you want to rollback or return soft error. 
            // In a real transactional flow we'd rollback customer. 
            // supabase client doesn't support tx well except through RPC.
            return NextResponse.json({ error: 'Customer built but Failed to save initial pricing structure.', details: contractError.message }, { status: 500 });
        }

        // 4. File Upload (if any)
        if (has_contract && contractFile && newContract) {
            const fileExt = contractFile.name.split('.').pop();
            const fileName = `${customerId}/${newContract.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const fileBuffer = await contractFile.arrayBuffer();

            const { error: uploadError } = await supabase.storage
                .from('contracts')
                .upload(fileName, fileBuffer, {
                    contentType: contractFile.type,
                    upsert: false
                });

            if (uploadError) {
                console.error('File upload failed during customer gen:', uploadError);
                // We won't block the whole request since main data passed
            } else {
                // Get URL
                const { data: urlData } = supabase.storage
                    .from('contracts')
                    .getPublicUrl(fileName);

                // Attach file record to contract DB
                await supabase
                    .from('customer_contract_files')
                    .insert({
                        contract_id: newContract.id,
                        file_name: contractFile.name,
                        file_url: urlData.publicUrl,
                        file_type: fileExt || 'unknown'
                    });
            }
        }

        return NextResponse.json({ id: customerId, contractId: newContract?.id });
    } catch (err: any) {
        console.error('[customers/new API] Error:', err);
        return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
    }
}
