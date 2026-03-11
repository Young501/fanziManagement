'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Save, X, History, Trash2, Loader2, AlertCircle } from 'lucide-react';

export default function NewCustomerPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    // ... (rest of form state)

    // Customer Company Profile State
    const [profileCompanyType, setProfileCompanyType] = useState('');
    const [companyNature, setCompanyNature] = useState('');
    const [taxRate, setTaxRate] = useState('');
    const [taxpayerNo, setTaxpayerNo] = useState('');
    const [legalPerson, setLegalPerson] = useState('');
    const [supervisor, setSupervisor] = useState('');
    const [financeContact, setFinanceContact] = useState('');
    const [taxHandler, setTaxHandler] = useState('');
    const [registrationDate, setRegistrationDate] = useState('');
    const [registeredCapital, setRegisteredCapital] = useState('');
    const [registeredCapitalUnit, setRegisteredCapitalUnit] = useState('万元');
    const [taxOffice, setTaxOffice] = useState('');
    const [taxAdmin, setTaxAdmin] = useState('');
    const [taxAdminPhone, setTaxAdminPhone] = useState('');
    const [community, setCommunity] = useState('');
    const [invoiceProxyFlag, setInvoiceProxyFlag] = useState(false);
    const [cloudAccounting, setCloudAccounting] = useState('');
    const [accountBookNo, setAccountBookNo] = useState('');
    const [serialNo, setSerialNo] = useState('');
    const [companyLoginName, setCompanyLoginName] = useState('');
    const [companyLoginPassword, setCompanyLoginPassword] = useState('');
    const [contractFlag, setContractFlag] = useState(false);
    const [profileNote, setProfileNote] = useState('');
    const [lastYearRevenue, setLastYearRevenue] = useState('');
    const [mainBusiness, setMainBusiness] = useState('');
    const [sealCompany, setSealCompany] = useState(false);
    const [sealLegal, setSealLegal] = useState(false);
    const [sealFinance, setSealFinance] = useState(false);
    const [sealInvoice, setSealInvoice] = useState(false);
    const [sealShareholder, setSealShareholder] = useState(false);
    const [receiptCardBankName, setReceiptCardBankName] = useState('');
    const [caToken, setCaToken] = useState(false);

    // Explicit Contract Fields
    const [contractName, setContractName] = useState('');
    const [contractNo, setContractNo] = useState('');
    const [contractType, setContractType] = useState('service');
    const [autoRenew, setAutoRenew] = useState(false);
    const [invoiceRule, setInvoiceRule] = useState('');
    const [contractRemark, setContractRemark] = useState('');
    const [signDate, setSignDate] = useState('');
    const [contractFile, setContractFile] = useState<File | null>(null);

    // Advanced Profile Toggle State
    const [showAdvancedProfile, setShowAdvancedProfile] = useState(false);

    // Initial Payment State
    const [hasPaid, setHasPaid] = useState(false);
    const [paidAmount, setPaidAmount] = useState('');
    const [paidAt, setPaidAt] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [paymentNote, setPaymentNote] = useState('');

    // History State
    const [records, setRecords] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const limit = 10;
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



    const [serviceManagers, setServiceManagers] = useState<string[]>([]);

    useEffect(() => {
        // Fetch service managers to populate dropdown
        fetch('/api/customers/service-managers')
            .then(res => res.json())
            .then(data => setServiceManagers(data.data || []))
            .catch(console.error);

        // Check user role
        const checkRole = async () => {
            const res = await fetch('/api/auth/me'); // Using the profile/me check usually available
            if (res.ok) {
                const data = await res.json();
                setUserRole(data.role || 'user');
            } else {
                // Fallback check via profile
                const profileRes = await fetch('/api/profile');
                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    setUserRole(profileData.data?.role);
                }
            }
        };
        checkRole();
    }, []);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, page]);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/customers/new/history?page=${page}&limit=${limit}`);
            if (!res.ok) throw new Error('获取历史记录失败');
            const data = await res.json();
            setRecords(data.data || []);
            setTotal(data.total ?? data.count ?? 0);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这条记录吗？该操作不可撤销。')) return;

        try {
            const res = await fetch(`/api/customers/new/history?id=${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '删除失败');
            }
            fetchHistory();
        } catch (err: any) {
            alert(err.message);
        }
    };

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

        if (!confirm('请确认新客户建档信息填写无误。\n\n确定要提交并创建该客户档案吗？')) {
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

            // Customer Company Profile Info
            const profilePayload = {
                company_type: profileCompanyType,
                company_nature: companyNature,
                tax_rate: taxRate,
                taxpayer_no: taxpayerNo,
                legal_person: legalPerson,
                supervisor: supervisor,
                finance_contact: financeContact,
                tax_handler: taxHandler,
                registration_date: registrationDate || null,
                registered_capital: registeredCapital || null,
                registered_capital_unit: registeredCapitalUnit,
                tax_office: taxOffice,
                tax_admin: taxAdmin,
                tax_admin_phone: taxAdminPhone,
                community: community,
                invoice_proxy_flag: invoiceProxyFlag,
                cloud_accounting: cloudAccounting,
                account_book_no: accountBookNo,
                serial_no: serialNo,
                company_login_name: companyLoginName,
                company_login_password: companyLoginPassword,
                contract_flag: contractFlag,
                note: profileNote,
                last_year_revenue: lastYearRevenue || null,
                main_business: mainBusiness,
                seal_company: sealCompany,
                seal_legal: sealLegal,
                seal_finance: sealFinance,
                seal_invoice: sealInvoice,
                seal_shareholder: sealShareholder,
                receipt_card_bank_name: receiptCardBankName,
                ca_token: caToken
            };
            formData.append('profileData', JSON.stringify(profilePayload));

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
                contract_type: contractType,
                auto_renew: autoRenew,
                invoice_rule: invoiceRule,
                remark: contractRemark,
                sign_date: signDate
            };
            formData.append('contractData', JSON.stringify(contractPayload));

            const paymentPayload = {
                has_paid: hasPaid,
                paid_amount: hasPaid ? paidAmount : null,
                paid_at: hasPaid ? paidAt : null,
                method: paymentMethod,
                note: paymentNote
            };
            formData.append('paymentData', JSON.stringify(paymentPayload));

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
                alert('客户创建成功');
                setActiveTab('history');
                // Optional: Reset basic form state here if needed
                setCompanyName('');
                setContactPerson('');
                setSubmitting(false);
            } else {
                setActiveTab('history');
                setSubmitting(false);
            }
        } catch (err: any) {
            setError(err.message);
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col bg-slate-50">
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header with Tabs */}
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm">
                                <UserPlus className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">新增客户</h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    管理新客户建档及历史成交记录
                                </p>
                            </div>
                        </div>

                        <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200">
                            <button
                                onClick={() => setActiveTab('form')}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'form'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                <UserPlus className="w-4 h-4" />
                                新客户建档
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'history'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                <History className="w-4 h-4" />
                                历史记录
                            </button>
                        </div>
                    </div>

                    {activeTab === 'form' ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">客户建档表单</span>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => router.push('/customers')}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors bg-white border border-slate-200"
                                    >
                                        <X className="w-4 h-4" />
                                        取消返回
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                        className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4" />
                                        {submitting ? '提交中...' : '确认并建档'}
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 sm:p-8">
                                {error && (
                                    <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            <span>{error}</span>
                                        </div>
                                        <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-lg">×</button>
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
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">合同类型</label>
                                                    <select
                                                        value={contractType}
                                                        onChange={e => setContractType(e.target.value)}
                                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white"
                                                        required
                                                    >
                                                        <option value="service">服务合同</option>
                                                        <option value="software">软件购买合同</option>
                                                        <option value="other">其他</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">自动续约</label>
                                                    <div className="flex items-center space-x-2 mt-2">
                                                        <input
                                                            type="checkbox"
                                                            id="autoRenew"
                                                            checked={autoRenew}
                                                            onChange={e => setAutoRenew(e.target.checked)}
                                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                        />
                                                        <label htmlFor="autoRenew" className="text-sm font-medium text-slate-700">到期自动延续</label>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">开票规则要求</label>
                                                    <input
                                                        type="text"
                                                        value={invoiceRule}
                                                        onChange={e => setInvoiceRule(e.target.value)}
                                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                                        placeholder="开票规则描述"
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
                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">合同备注</label>
                                                    <textarea
                                                        rows={2}
                                                        value={contractRemark}
                                                        onChange={e => setContractRemark(e.target.value)}
                                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                                        placeholder="合同相关说明"
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
                                <div className={`mt-8 mb-6 pb-4 border rounded-xl overflow-hidden transition-all ${hasPaid ? 'border-blue-400 shadow-md ring-1 ring-blue-100' : 'border-slate-200 shadow-sm'}`}>
                                    <div className={`px-6 py-4 flex items-center justify-between ${hasPaid ? 'bg-blue-50/80 border-b border-blue-100' : 'bg-slate-50 border-b border-slate-100'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasPaid ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h2 className={`text-lg font-bold ${hasPaid ? 'text-blue-900' : 'text-slate-800'}`}>首期收款确认</h2>
                                                <p className="text-xs text-slate-500 mt-0.5">确认是否在建档时已完成首次款项支付</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <input
                                                type="checkbox"
                                                id="hasPaid"
                                                checked={hasPaid}
                                                onChange={e => setHasPaid(e.target.checked)}
                                                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <label htmlFor="hasPaid" className={`text-sm font-semibold cursor-pointer select-none ${hasPaid ? 'text-blue-700' : 'text-slate-600'}`}>建档时已收首期款/全款</label>
                                        </div>
                                    </div>
                                    {hasPaid && (
                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 bg-blue-50/20">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">已收金额 (元) <span className="text-red-500">*</span></label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={paidAmount}
                                                    onChange={e => setPaidAmount(e.target.value)}
                                                    className="w-full rounded-xl border border-blue-200 py-3 px-4 text-blue-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white"
                                                    placeholder="0.00"
                                                    required={hasPaid}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">收款日期 <span className="text-red-500">*</span></label>
                                                <input
                                                    type="date"
                                                    value={paidAt}
                                                    onChange={e => setPaidAt(e.target.value)}
                                                    className="w-full rounded-xl border border-blue-200 py-3 px-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white"
                                                    required={hasPaid}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">收款方式 <span className="text-red-500">*</span></label>
                                                <select
                                                    value={paymentMethod}
                                                    onChange={e => setPaymentMethod(e.target.value)}
                                                    className="w-full rounded-xl border border-blue-200 py-3 px-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white"
                                                    required={hasPaid}
                                                >
                                                    <option value="">-- 请选择 --</option>

                                                    <option value="微信支付">微信支付</option>
                                                    <option value="支付宝">支付宝</option>
                                                    <option value="现金">现金</option>
                                                    <option value="银行汇款">银行汇款</option>
                                                    <option value="其他">其他</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">收款备注</label>
                                                <input
                                                    type="text"
                                                    value={paymentNote}
                                                    onChange={e => setPaymentNote(e.target.value)}
                                                    className="w-full rounded-xl border border-blue-200 py-3 px-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8 mb-4 border rounded-xl overflow-hidden border-slate-200 shadow-sm transition-all">
                                    <div
                                        className="px-6 py-4 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => setShowAdvancedProfile(!showAdvancedProfile)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                                                <UserPlus className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-semibold text-slate-800">客户画像 / 公司详细信息 (选填)</h2>
                                                <p className="text-xs text-slate-500">可在未来方便时补充完善</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className={`p-2 rounded-full hover:bg-slate-200 transition-transform ${showAdvancedProfile ? 'rotate-180' : ''}`}
                                        >
                                            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>

                                    {showAdvancedProfile && (
                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 border-t border-slate-100">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">公司类型</label>
                                                <input type="text" value={profileCompanyType} onChange={e => setProfileCompanyType(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">企业性质</label>
                                                <input type="text" value={companyNature} onChange={e => setCompanyNature(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">税率</label>
                                                <input type="text" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">纳税人识别号</label>
                                                <input type="text" value={taxpayerNo} onChange={e => setTaxpayerNo(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">法人代表</label>
                                                <input type="text" value={legalPerson} onChange={e => setLegalPerson(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">监事</label>
                                                <input type="text" value={supervisor} onChange={e => setSupervisor(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">财务联系人</label>
                                                <input type="text" value={financeContact} onChange={e => setFinanceContact(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">办税员</label>
                                                <input type="text" value={taxHandler} onChange={e => setTaxHandler(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">注册日期</label>
                                                <input type="date" value={registrationDate} onChange={e => setRegistrationDate(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">注册资本</label>
                                                <div className="flex">
                                                    <input type="number" step="0.01" value={registeredCapital} onChange={e => setRegisteredCapital(e.target.value)} className="flex-1 rounded-l-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                                    <select value={registeredCapitalUnit} onChange={e => setRegisteredCapitalUnit(e.target.value)} className="rounded-r-xl border border-l-0 border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-slate-50">
                                                        <option value="元">元</option>
                                                        <option value="万元">万元</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">所属税局</label>
                                                <input type="text" value={taxOffice} onChange={e => setTaxOffice(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">税管员</label>
                                                <input type="text" value={taxAdmin} onChange={e => setTaxAdmin(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">税管员电话</label>
                                                <input type="text" value={taxAdminPhone} onChange={e => setTaxAdminPhone(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">所属社区</label>
                                                <input type="text" value={community} onChange={e => setCommunity(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">代开发票</label>
                                                <div className="flex items-center space-x-2 mt-2">
                                                    <input type="checkbox" id="invoiceProxyFlag" checked={invoiceProxyFlag} onChange={e => setInvoiceProxyFlag(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                                    <label htmlFor="invoiceProxyFlag" className="text-sm font-medium text-slate-700">是</label>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">云账房</label>
                                                <input type="text" value={cloudAccounting} onChange={e => setCloudAccounting(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">账本编号</label>
                                                <input type="text" value={accountBookNo} onChange={e => setAccountBookNo(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">序号档案</label>
                                                <input type="text" value={serialNo} onChange={e => setSerialNo(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">税局登录名</label>
                                                <input type="text" value={companyLoginName} onChange={e => setCompanyLoginName(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">税局登录密码</label>
                                                <input type="text" value={companyLoginPassword} onChange={e => setCompanyLoginPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">合同归档</label>
                                                <div className="flex items-center space-x-2 mt-2">
                                                    <input type="checkbox" id="contractFlag" checked={contractFlag} onChange={e => setContractFlag(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                                    <label htmlFor="contractFlag" className="text-sm font-medium text-slate-700">已归档</label>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">上年营收额 (元)</label>
                                                <input type="number" step="0.01" value={lastYearRevenue} onChange={e => setLastYearRevenue(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-slate-700 mb-1">主营业务简述</label>
                                                <textarea rows={2} value={mainBusiness} onChange={e => setMainBusiness(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="简要描述公司的主要经营业务"></textarea>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-slate-700 mb-1">印章留存</label>
                                                <div className="flex flex-wrap gap-4 mt-2">
                                                    <div className="flex items-center space-x-2">
                                                        <input type="checkbox" id="sealCompany" checked={sealCompany} onChange={e => setSealCompany(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                                        <label htmlFor="sealCompany" className="text-sm font-medium text-slate-700">公章</label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <input type="checkbox" id="sealLegal" checked={sealLegal} onChange={e => setSealLegal(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                                        <label htmlFor="sealLegal" className="text-sm font-medium text-slate-700">法人章</label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <input type="checkbox" id="sealFinance" checked={sealFinance} onChange={e => setSealFinance(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                                        <label htmlFor="sealFinance" className="text-sm font-medium text-slate-700">财务章</label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <input type="checkbox" id="sealInvoice" checked={sealInvoice} onChange={e => setInvoiceProxyFlag(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                                        <label htmlFor="sealInvoice" className="text-sm font-medium text-slate-700">发票章</label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <input type="checkbox" id="sealShareholder" checked={sealShareholder} onChange={e => setSealShareholder(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                                        <label htmlFor="sealShareholder" className="text-sm font-medium text-slate-700">股东章</label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">开户银行名称</label>
                                                <input type="text" value={receiptCardBankName} onChange={e => setReceiptCardBankName(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">CA扣款标志</label>
                                                <div className="flex items-center space-x-2 mt-2">
                                                    <input type="checkbox" id="caToken" checked={caToken} onChange={e => setCaToken(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                                    <label htmlFor="caToken" className="text-sm font-medium text-slate-700">有</label>
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-slate-700 mb-1">画像备注</label>
                                                <input type="text" value={profileNote} onChange={e => setProfileNote(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all" placeholder="" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
                            {loadingHistory ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-20">
                                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                                    <p className="text-slate-500 font-medium">加载历史记录中...</p>
                                </div>
                            ) : records.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-20">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <History className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-slate-900 font-semibold text-lg">暂无历史记录</h3>
                                    <p className="text-slate-500 mt-1 max-w-xs text-center">
                                        目前系统内没有 2026-03-10 以后的新开户记录。
                                    </p>
                                    <button
                                        onClick={() => setActiveTab('form')}
                                        className="mt-6 text-blue-600 font-medium hover:underline"
                                    >
                                        立即去建档
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto flex-1">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">客户名称</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">建档日期</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">负责人</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">客户类型</th>
                                                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {records.map((record) => (
                                                    <tr key={record.id} className="hover:bg-slate-50/30 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="font-medium text-slate-900">{record.company_name}</div>
                                                            <div className="text-xs text-slate-400 mt-0.5">{record.unified_social_credit_code || '无信用代码'}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-600">
                                                            {new Date(record.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                                {record.service_manager || '未分配'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-600">
                                                            {record.customer_type}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {userRole?.toLowerCase() === 'admin' && (
                                                                <button
                                                                    onClick={() => handleDelete(record.id)}
                                                                    className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                    title="删除记录"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination */}
                                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                        <p className="text-sm text-slate-500">
                                            显示第 <span className="font-medium">{(page - 1) * limit + 1}</span> 至 <span className="font-medium">{Math.min(page * limit, total)}</span> 条记录，共 <span className="font-medium">{total}</span> 条
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                disabled={page === 1}
                                                onClick={() => setPage(p => p - 1)}
                                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                                            >
                                                上一页
                                            </button>
                                            <button
                                                disabled={page * limit >= total}
                                                onClick={() => setPage(p => p + 1)}
                                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                                            >
                                                下一页
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
