import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { calculateReceivableStatus } from '@/lib/finance-status';

type Payload = Record<string, unknown>;
type AdminClient = ReturnType<typeof createAdminClient>;

const MAX_CONTRACT_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_CONTRACT_FILE_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);
const ALLOWED_NEW_CUSTOMER_STATUSES = new Set(['正常', '拖欠户', '风险户']);

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

function jsonError(message: string, status = 400, details?: unknown) {
    return NextResponse.json({ error: message, details }, { status });
}

function parsePayload(value: FormDataEntryValue | null, label: string): Payload {
    if (!value || typeof value !== 'string') {
        throw new Error(`${label} 缺失`);
    }

    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${label} 格式不正确`);
    }

    return parsed as Payload;
}

function readString(payload: Payload, key: string) {
    const value = payload[key];
    return typeof value === 'string' ? value.trim() : '';
}

function readBoolean(payload: Payload, key: string, fallback = false) {
    const value = payload[key];
    return typeof value === 'boolean' ? value : fallback;
}

function parseAmount(value: unknown, fieldName: string, required = false) {
    if (value === null || value === undefined || value === '') {
        if (required) throw new Error(`请填写${fieldName}`);
        return null;
    }

    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`${fieldName}必须是大于等于 0 的数字`);
    }

    return amount;
}

function parsePositiveAmount(value: unknown, fieldName: string) {
    const amount = parseAmount(value, fieldName, true);
    if (!amount || amount <= 0) {
        throw new Error(`${fieldName}必须大于 0`);
    }
    return amount;
}

function parseCycleMonths(value: unknown) {
    if (value === null || value === undefined || value === '') {
        throw new Error('请选择收款周期');
    }

    const months = Number(value);
    if (!Number.isInteger(months) || months < 0) {
        throw new Error('收款周期不正确');
    }

    return months;
}

function assertValidDate(value: string, fieldName: string) {
    if (!value || Number.isNaN(new Date(value).getTime())) {
        throw new Error(`请选择有效的${fieldName}`);
    }
}

function getFileExtension(fileName: string) {
    return fileName.split('.').pop()?.toLowerCase() || '';
}

async function rollbackCustomer(supabase: AdminClient, customerId: string, uploadedFilePath?: string) {
    if (uploadedFilePath) {
        await supabase.storage.from('contracts').remove([uploadedFilePath]);
    }

    const { data: contracts } = await supabase
        .from('customer_contracts')
        .select('id')
        .eq('customer_id', customerId);

    const contractIds = (contracts || []).map((contract) => contract.id).filter(Boolean);

    if (contractIds.length > 0) {
        await supabase
            .from('customer_contract_files')
            .delete()
            .in('contract_id', contractIds);
    }

    const deleteSteps = [
        'collection_tasks',
        'payment_records',
        'expense_records',
        'customer_ad_hoc_services',
        'company_receivables',
        'customer_shareholders',
        'customer_company_profiles',
        'customer_churn_logs',
        'customer_contracts',
    ];

    for (const table of deleteSteps) {
        await supabase.from(table).delete().eq('customer_id', customerId);
    }

    await supabase.from('customers').delete().eq('id', customerId);
}

export async function POST(request: NextRequest) {
    let supabase: AdminClient | null = null;
    let customerId = '';
    let uploadedFilePath: string | undefined;

    try {
        const formData = await request.formData();
        const rawContractFile = formData.get('contract_file');
        const contractFile = rawContractFile instanceof File && rawContractFile.size > 0 ? rawContractFile : null;

        let customerInfo: Payload;
        let contractInfo: Payload;
        let profileInfo: Payload;
        let paymentInfo: Payload;

        try {
            customerInfo = parsePayload(formData.get('customerData'), '客户信息');
            contractInfo = parsePayload(formData.get('contractData'), '合同信息');
            profileInfo = parsePayload(formData.get('profileData'), '公司画像');
            paymentInfo = parsePayload(formData.get('paymentData'), '收款信息');
        } catch (err) {
            const message = err instanceof Error ? err.message : '提交数据格式不正确';
            return jsonError(message, 400);
        }

        const companyName = readString(customerInfo, 'company_name');
        const companyCode = readString(customerInfo, 'company_code');
        const unifiedSocialCreditCode = readString(customerInfo, 'unified_social_credit_code');
        const industry = readString(customerInfo, 'industry');
        const customerType = readString(customerInfo, 'customer_type');
        const contactPerson = readString(customerInfo, 'contact_person');
        const contactInfo = readString(customerInfo, 'contact_info');
        const websiteMemberName = readString(customerInfo, 'website_member_name');
        const customerStatus = readString(customerInfo, 'customer_status') || '正常';
        const sourceInfo = readString(customerInfo, 'source_info');
        const sourceRemark = readString(customerInfo, 'source_remark');
        const serviceManager = readString(customerInfo, 'service_manager');
        const address = readString(customerInfo, 'address');

        const hasContract = readBoolean(contractInfo, 'has_contract');
        const standardPrice = parsePositiveAmount(contractInfo.standard_price, '每个收款周期总金额');
        const billingFeeMonth = parseAmount(contractInfo.billing_fee_month, '月均代账费/杂费');
        const payCycleMonths = parseCycleMonths(contractInfo.pay_cycle_months);
        const effectiveDate = readString(contractInfo, 'effective_date');
        const depositAmount = parseAmount(contractInfo.deposit_amount, '押金/定金金额') ?? 0;
        const contractName = readString(contractInfo, 'contract_name');
        const contractNo = readString(contractInfo, 'contract_no');
        const contractType = readString(contractInfo, 'contract_type');
        const autoRenew = readBoolean(contractInfo, 'auto_renew', true);
        const invoiceRule = readString(contractInfo, 'invoice_rule');
        const contractRemark = readString(contractInfo, 'remark');
        const signDate = readString(contractInfo, 'sign_date');

        const hasPaid = readBoolean(paymentInfo, 'has_paid');
        const paidAmount = hasPaid ? parsePositiveAmount(paymentInfo.paid_amount, '已收金额') : null;
        const paidAt = readString(paymentInfo, 'paid_at');
        const paymentMethod = readString(paymentInfo, 'method');
        const paymentNote = readString(paymentInfo, 'note');

        try {
            if (!companyName || companyName.length < 2) throw new Error('请填写完整的公司/客户名称');
            if (!contactPerson) throw new Error('请填写主要联系人');
            if (!ALLOWED_NEW_CUSTOMER_STATUSES.has(customerStatus)) {
                throw new Error('新增客户不能直接建为流失状态，请先建档后通过流失登记处理');
            }
            assertValidDate(effectiveDate, '服务生效/计费起始日');
            if (signDate) assertValidDate(signDate, '实际签订日期');
            if (hasContract && !contractName) throw new Error('有正规合同时，请填写合同系统命名名称');
            if (hasPaid) {
                assertValidDate(paidAt, '收款日期');
                if (!paymentMethod) throw new Error('已收首期款时，请选择收款方式');
                if (paidAmount && paidAmount > standardPrice + 0.01) {
                    throw new Error('已收金额不能超过本期应收金额。押金/预收款请单独填写押金字段或登记为一次性收款');
                }
            }
            if (contractFile) {
                const fileExt = getFileExtension(contractFile.name);
                if (!ALLOWED_CONTRACT_FILE_EXTENSIONS.has(fileExt)) {
                    throw new Error('合同附件仅支持 PDF、JPG、JPEG、PNG');
                }
                if (contractFile.size > MAX_CONTRACT_FILE_SIZE) {
                    throw new Error('合同附件不能超过 50MB');
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : '提交数据校验失败';
            return jsonError(message, 400);
        }

        supabase = createAdminClient();

        const { data: existingCustomer, error: duplicateCheckError } = await supabase
            .from('customers')
            .select('id, customer_status')
            .eq('company_name', companyName)
            .neq('customer_status', '流失')
            .maybeSingle();

        if (duplicateCheckError) {
            return jsonError(`检查重复客户失败: ${duplicateCheckError.message}`, 500);
        }

        if (existingCustomer) {
            return jsonError('已有同名的有效客户档案，请先在客户档案中核对后再建档', 409, existingCustomer);
        }

        const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
                company_name: companyName,
                company_code: companyCode || null,
                unified_social_credit_code: unifiedSocialCreditCode || null,
                industry: industry || null,
                customer_type: customerType || null,
                contact_person: contactPerson,
                contact_info: contactInfo || null,
                website_member_name: websiteMemberName || null,
                customer_status: customerStatus,
                source_info: sourceInfo || null,
                source_remark: sourceRemark || null,
                service_manager: serviceManager || null,
                address: address || null,
            })
            .select('id')
            .single();

        if (customerError || !newCustomer) {
            console.error('[customers/new API] Insert error:', customerError);
            return jsonError(customerError?.message || '创建客户档案失败', 500);
        }

        customerId = newCustomer.id;

        const { error: profileError } = await supabase
            .from('customer_company_profiles')
            .insert({
                customer_id: customerId,
                ...profileInfo,
            });

        if (profileError) {
            console.error('[customers/new API] Profile insert error:', profileError);
            await rollbackCustomer(supabase, customerId);
            return jsonError(`创建公司画像失败: ${profileError.message}`, 500);
        }

        let finalContractName = contractName;
        if (!hasContract) {
            finalContractName = `【无纸质合同】${companyName} - 首期默认服务设定`;
        } else if (!finalContractName) {
            finalContractName = `【系统生成】${companyName} 首签补充合同`;
        }

        const { data: newContract, error: contractError } = await supabase
            .from('customer_contracts')
            .insert({
                customer_id: customerId,
                contract_name: finalContractName,
                contract_no: contractNo || null,
                contract_type: contractType || (hasContract ? 'service' : '无合同初始价格'),
                sign_date: signDate || null,
                effective_date: effectiveDate,
                start_date: effectiveDate,
                status: '执行中',
                is_current: true,
                pay_cycle_months: payCycleMonths,
                billing_fee_month: billingFeeMonth,
                standard_price: standardPrice,
                deposit_amount: depositAmount,
                auto_renew: autoRenew,
                invoice_rule: invoiceRule || null,
                remark: contractRemark || null,
            })
            .select('id')
            .single();

        if (contractError || !newContract) {
            console.error('[customers/new API] Contract insert error:', contractError);
            await rollbackCustomer(supabase, customerId);
            return jsonError(contractError?.message || '保存首期合同/价格设置失败', 500);
        }

        const warnings: string[] = [];

        if (hasContract && contractFile) {
            const fileExt = getFileExtension(contractFile.name);
            const fileName = `${customerId}/${newContract.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
            const fileBuffer = await contractFile.arrayBuffer();

            const { error: uploadError } = await supabase.storage
                .from('contracts')
                .upload(fileName, fileBuffer, {
                    contentType: contractFile.type || 'application/octet-stream',
                    upsert: false,
                });

            if (uploadError) {
                console.error('[customers/new API] File upload error:', uploadError);
                warnings.push(`合同附件上传失败: ${uploadError.message}`);
            } else {
                uploadedFilePath = fileName;
                const { data: urlData } = supabase.storage
                    .from('contracts')
                    .getPublicUrl(fileName);

                const { error: fileRecordError } = await supabase
                    .from('customer_contract_files')
                    .insert({
                        contract_id: newContract.id,
                        file_name: contractFile.name,
                        file_url: urlData.publicUrl,
                        file_type: fileExt || 'unknown',
                    });

                if (fileRecordError) {
                    console.error('[customers/new API] File record error:', fileRecordError);
                    await supabase.storage.from('contracts').remove([fileName]);
                    uploadedFilePath = undefined;
                    warnings.push(`合同附件记录保存失败: ${fileRecordError.message}`);
                }
            }
        }

        const firstCycleEnd = new Date(effectiveDate);
        firstCycleEnd.setMonth(firstCycleEnd.getMonth() + (payCycleMonths > 0 ? payCycleMonths : 1));
        firstCycleEnd.setDate(firstCycleEnd.getDate() - 1);

        if (hasPaid) {
            const firstStatus = calculateReceivableStatus(paidAmount || 0, standardPrice, effectiveDate);
            const { data: firstReceivable, error: firstReceivableError } = await supabase
                .from('company_receivables')
                .insert({
                    customer_id: customerId,
                    status: firstStatus,
                    payment_due_date: effectiveDate,
                    contract_end_date: firstCycleEnd.toISOString().split('T')[0],
                    amount_payable_period: standardPrice,
                    amount_paid_period: paidAmount,
                    standard_price: standardPrice,
                    billing_fee_month: billingFeeMonth,
                    pay_cycle_months: payCycleMonths,
                    has_contract: hasContract,
                    note: firstStatus === 'paid' ? '新客户建档自带首期款项结清' : '新客户建档自带首期部分收款',
                    current_receipt_date: paidAt,
                    current_receipt_amount: paidAmount,
                })
                .select('id')
                .single();

            if (firstReceivableError || !firstReceivable) {
                console.error('[customers/new API] First receivable insert error:', firstReceivableError);
                await rollbackCustomer(supabase, customerId, uploadedFilePath);
                return jsonError(firstReceivableError?.message || '生成首期已收账单失败', 500);
            }

            const { error: paymentError } = await supabase
                .from('payment_records')
                .insert({
                    customer_id: customerId,
                    receivable_id: firstReceivable.id,
                    paid_amount: paidAmount,
                    paid_at: paidAt,
                    method: paymentMethod,
                    note: paymentNote || '新开户首期付款',
                });

            if (paymentError) {
                console.error('[customers/new API] Payment insert error:', paymentError);
                await rollbackCustomer(supabase, customerId, uploadedFilePath);
                return jsonError(`登记首期收款失败: ${paymentError.message}`, 500);
            }

            if (payCycleMonths > 0 && firstStatus === 'paid') {
                const nextCycleStart = new Date(effectiveDate);
                nextCycleStart.setMonth(nextCycleStart.getMonth() + payCycleMonths);

                const nextCycleEnd = new Date(nextCycleStart);
                nextCycleEnd.setMonth(nextCycleEnd.getMonth() + payCycleMonths);
                nextCycleEnd.setDate(nextCycleEnd.getDate() - 1);

                const nextDueDate = new Date(nextCycleStart);
                nextDueDate.setDate(nextDueDate.getDate() - 1);
                const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

                const { error: nextReceivableError } = await supabase
                    .from('company_receivables')
                    .insert({
                        customer_id: customerId,
                        status: calculateReceivableStatus(0, standardPrice, nextDueDateStr),
                        payment_due_date: nextDueDateStr,
                        contract_end_date: nextCycleEnd.toISOString().split('T')[0],
                        amount_payable_period: standardPrice,
                        amount_paid_period: 0,
                        standard_price: standardPrice,
                        billing_fee_month: billingFeeMonth,
                        pay_cycle_months: payCycleMonths,
                        has_contract: hasContract,
                        note: '首期付款结清后自动生成',
                    });

                if (nextReceivableError) {
                    console.error('[customers/new API] Next receivable insert error:', nextReceivableError);
                    await rollbackCustomer(supabase, customerId, uploadedFilePath);
                    return jsonError(`生成下一周期应收账单失败: ${nextReceivableError.message}`, 500);
                }
            }
        } else {
            const firstStatus = calculateReceivableStatus(0, standardPrice, effectiveDate);
            const { error: receivableError } = await supabase
                .from('company_receivables')
                .insert({
                    customer_id: customerId,
                    status: firstStatus,
                    payment_due_date: effectiveDate,
                    contract_end_date: firstCycleEnd.toISOString().split('T')[0],
                    amount_payable_period: standardPrice,
                    amount_paid_period: 0,
                    standard_price: standardPrice,
                    billing_fee_month: billingFeeMonth,
                    pay_cycle_months: payCycleMonths,
                    has_contract: hasContract,
                    note: '客户建档生成的首期服务账单',
                });

            if (receivableError) {
                console.error('[customers/new API] Receivable insert error:', receivableError);
                await rollbackCustomer(supabase, customerId, uploadedFilePath);
                return jsonError(`生成首期应收账单失败: ${receivableError.message}`, 500);
            }
        }

        return NextResponse.json({
            id: customerId,
            contractId: newContract.id,
            warnings,
        });
    } catch (err) {
        console.error('[customers/new API] Error:', err);

        if (supabase && customerId) {
            await rollbackCustomer(supabase, customerId, uploadedFilePath);
        }

        const message = err instanceof Error ? err.message : 'Internal server error';
        return jsonError(message, 500);
    }
}
