'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Save, X } from 'lucide-react';

export default function NewCustomerPage() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [companyName, setCompanyName] = useState('');
    const [companyCode, setCompanyCode] = useState('');
    const [unifiedSocialCreditCode, setUnifiedSocialCreditCode] = useState('');
    const [industry, setIndustry] = useState('');
    const [customerType, setCustomerType] = useState('企业');
    const [contactPerson, setContactPerson] = useState('');
    const [contactInfo, setContactInfo] = useState('');
    const [websiteMemberName, setWebsiteMemberName] = useState('');
    const [customerStatus, setCustomerStatus] = useState('正常');
    const [sourceInfo, setSourceInfo] = useState('');
    const [serviceManager, setServiceManager] = useState('');
    const [address, setAddress] = useState('');

    // Service & Contract State
    const [hasContract, setHasContract] = useState(false);
    const [standardPrice, setStandardPrice] = useState(''); // required
    const [billingFeeMonth, setBillingFeeMonth] = useState('');
    const [payCycleMonths, setPayCycleMonths] = useState(''); // required
    const [effectiveDate, setEffectiveDate] = useState(''); // required
    const [depositAmount, setDepositAmount] = useState('');

    // Explicit Contract Fields
    const [contractName, setContractName] = useState('');
    const [contractNo, setContractNo] = useState('');
    const [signDate, setSignDate] = useState('');
    const [contractFile, setContractFile] = useState<File | null>(null);

    const [serviceManagers, setServiceManagers] = useState<string[]>([]);

    useEffect(() => {
        // Fetch service managers to populate dropdown
        fetch('/api/customers/service-managers')
            .then(res => res.json())
            .then(data => setServiceManagers(data.data || []))
            .catch(console.error);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyName || !contactPerson) {
            setError('请填写公司名称和联系人');
            return;
        }
        if (!standardPrice || !payCycleMonths || !effectiveDate) {
            setError('请填写服务价格相关的必填项 (标准报价、收款周期、生效日期)');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const formData = new FormData();

            // Basic customer info
            const customerPayload = {
                company_name: companyName,
                company_code: companyCode,
                unified_social_credit_code: unifiedSocialCreditCode,
                industry: industry,
                customer_type: customerType,
                contact_person: contactPerson,
                contact_info: contactInfo,
                website_member_name: websiteMemberName,
                customer_status: customerStatus,
                source_info: sourceInfo,
                service_manager: serviceManager,
                address: address
            };
            formData.append('customerData', JSON.stringify(customerPayload));

            // Contract / Pricing info
            const contractPayload = {
                has_contract: hasContract,
                standard_price: standardPrice,
                billing_fee_month: billingFeeMonth,
                pay_cycle_months: payCycleMonths,
                effective_date: effectiveDate,
                deposit_amount: depositAmount,
                contract_name: contractName,
                contract_no: contractNo,
                sign_date: signDate
            };
            formData.append('contractData', JSON.stringify(contractPayload));

            if (hasContract && contractFile) {
                formData.append('contract_file', contractFile);
            }

            const res = await fetch('/api/customers/new', {
                method: 'POST',
                // Content-Type gets set automatically by browser when using FormData
                body: formData
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '创建失败');
            }

            const data = await res.json();
            if (data.id) {
                // Navigate back to the customer list since detail is a slide-over
                router.push('/customers');
            } else {
                router.push('/customers');
            }
        } catch (err: any) {
            setError(err.message);
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-auto">
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    <form id="new-customer-form" onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="px-6 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                    <UserPlus className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-slate-900">新客户建档</h1>
                                    <p className="text-sm text-slate-500 mt-1">
                                        在系统中建立全新的客户及联系人档案，以便开始业务跟进。
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => router.push('/customers')}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors bg-white border border-slate-200"
                                >
                                    <X className="w-4 h-4" />
                                    取消并返回列表
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    {submitting ? '保存中...' : '提交'}
                                </button>
                            </div>
                        </div>

                        <div className="p-6 sm:p-8">
                            {error && (
                                <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm flex items-center justify-between">
                                    <span>{error}</span>
                                    <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600">×</button>
                                </div>
                            )}

                            <div className="mb-6 pb-3 border-b border-slate-100">
                                <h2 className="text-lg font-semibold text-slate-800">基础信息</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">公司/客户名称 <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={e => setCompanyName(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="请输入完整的企业或个人名称"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">统一社会信用代码</label>
                                    <input
                                        type="text"
                                        value={unifiedSocialCreditCode}
                                        onChange={e => setUnifiedSocialCreditCode(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="组织机构代码或信用代码"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">企业代号/企业字号</label>
                                    <input
                                        type="text"
                                        value={companyCode}
                                        onChange={e => setCompanyCode(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="内部助记码或代号"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">客户类型</label>
                                    <select
                                        value={customerType}
                                        onChange={e => setCustomerType(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white"
                                    >
                                        <option value="企业">企业</option>
                                        <option value="个体户">个体户</option>
                                        <option value="个人">个人</option>
                                        <option value="其他">其他</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">所属行业</label>
                                    <input
                                        type="text"
                                        value={industry}
                                        onChange={e => setIndustry(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="如：科技、贸易、制造等"
                                    />
                                </div>

                                <div className="md:col-span-2 mt-2 mb-2 pb-2 border-b border-slate-100">
                                    <h2 className="text-lg font-semibold text-slate-800">联系与运营信息</h2>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">主要联系人 <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={contactPerson}
                                        onChange={e => setContactPerson(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="联系人姓名"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">联系电话</label>
                                    <input
                                        type="text"
                                        value={contactInfo}
                                        onChange={e => setContactInfo(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="手机号或座机"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">客户来源</label>
                                    <input
                                        type="text"
                                        value={sourceInfo}
                                        onChange={e => setSourceInfo(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="如：老客户介绍、抖音、网站"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">分配客服/财务</label>
                                    <select
                                        value={serviceManager}
                                        onChange={e => setServiceManager(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white"
                                    >
                                        <option value="">请选择负责人</option>
                                        {serviceManagers.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">初始客户状态</label>
                                    <select
                                        value={customerStatus}
                                        onChange={e => setCustomerStatus(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white"
                                    >
                                        <option value="正常">正常</option>
                                        <option value="拖欠户">拖欠户</option>
                                        <option value="流失">流失</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">官网认证账号</label>
                                    <input
                                        type="text"
                                        value={websiteMemberName}
                                        onChange={e => setWebsiteMemberName(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="如适用，请填写官网账号ID"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">通信/办公地址</label>
                                    <input
                                        type="text"
                                        value={address}
                                        onChange={e => setAddress(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="详细办公或寄件地址"
                                    />
                                </div>
                            </div>

                            <div className="mt-8 mb-6 pb-3 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-slate-800">服务价格与首签合同设置</h2>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="hasContract"
                                        checked={hasContract}
                                        onChange={e => setHasContract(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <label htmlFor="hasContract" className="text-sm font-medium text-blue-700">本次有签署正规生效合同</label>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">标准报价/指导价 (元) <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={standardPrice}
                                        onChange={e => setStandardPrice(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">收款周期 <span className="text-red-500">*</span></label>
                                    <select
                                        value={payCycleMonths}
                                        onChange={e => setPayCycleMonths(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white"
                                        required
                                    >
                                        <option value="">-- 请选择 --</option>
                                        <option value="0">跟随项目/一次性支付</option>
                                        <option value="1">月付 (1个月)</option>
                                        <option value="3">季付 (3个月)</option>
                                        <option value="6">半年付 (6个月)</option>
                                        <option value="12">年付 (12个月)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">月均代账费/杂费 (元/月)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={billingFeeMonth}
                                        onChange={e => setBillingFeeMonth(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="如适用，记录每月基础服务费"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">服务生效/计费起始日 <span className="text-red-500">*</span></label>
                                    <input
                                        type="date"
                                        value={effectiveDate}
                                        onChange={e => setEffectiveDate(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">押金/定金收复总额 (元)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={depositAmount}
                                        onChange={e => setDepositAmount(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="0.00"
                                    />
                                </div>

                                {hasContract && (
                                    <>
                                        <div className="md:col-span-2 mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                            <div className="md:col-span-2">
                                                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                                                    <div className="text-blue-500 mt-0.5 w-5 h-5 flex-shrink-0">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-blue-800 text-sm">合同详情档案</p>
                                                        <p className="text-slate-600 text-sm mt-1">由于您勾选了有正规签署合同，请完善以下核心合同要素，保存后系统将自动为您在【合同管理】建立同名首笔主合同记录。</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">合同系统命名名称 <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={contractName}
                                                    onChange={e => setContractName(e.target.value)}
                                                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                                    placeholder="如：【2024】日常代记账服务协议"
                                                    required={hasContract}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">纸质/原版合同编号</label>
                                                <input
                                                    type="text"
                                                    value={contractNo}
                                                    onChange={e => setContractNo(e.target.value)}
                                                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                                    placeholder="如：HT-2024-XXXX"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">实际签订日期</label>
                                                <input
                                                    type="date"
                                                    value={signDate}
                                                    onChange={e => setSignDate(e.target.value)}
                                                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">附件原件 / 扫描件上传 (可选)</label>
                                                <div className="mt-1 flex justify-center rounded-xl border border-dashed border-slate-300 px-6 py-4 transition-colors hover:border-blue-400 focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 overflow-hidden relative bg-slate-50">
                                                    <div className="text-center">
                                                        {contractFile ? (
                                                            <div className="flex flex-col items-center">
                                                                <p className="text-sm font-medium text-blue-600 truncate max-w-[200px]">{contractFile.name}</p>
                                                                <p className="text-xs text-slate-500">{(contractFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                                                <button type="button" onClick={() => setContractFile(null)} className="mt-2 text-xs text-red-500 hover:underline">移除重传</button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <svg className="mx-auto h-8 w-8 text-slate-400 mb-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                                    <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                                                                </svg>
                                                                <div className="flex text-sm leading-6 text-slate-600 text-center">
                                                                    <label htmlFor="file-upload" className="relative cursor-pointer rounded-md bg-transparent font-semibold text-blue-600 focus-within:outline-none hover:text-blue-500 truncate w-full flex justify-center">
                                                                        <span>点击选择文件上传</span>
                                                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={e => {
                                                                            if (e.target.files && e.target.files.length > 0) {
                                                                                setContractFile(e.target.files[0]);
                                                                            }
                                                                        }} />
                                                                    </label>
                                                                </div>
                                                                <p className="text-xs leading-5 text-slate-500 mt-1">支持 PDF, JPG, PNG 最大 50MB</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
