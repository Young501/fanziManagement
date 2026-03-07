'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileSignature, Save, X } from 'lucide-react';
import Select from 'react-select';

export default function NewContractPage() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [customerId, setCustomerId] = useState('');
    const [contractNo, setContractNo] = useState('');
    const [contractName, setContractName] = useState('');
    const [contractType, setContractType] = useState('一般合同');
    const [totalContractAmount, setTotalContractAmount] = useState('');
    const [standardPrice, setStandardPrice] = useState('');
    const [discountAmount, setDiscountAmount] = useState('');
    const [depositAmount, setDepositAmount] = useState('');
    const [payCycleMonths, setPayCycleMonths] = useState('');
    const [billingFeeMonth, setBillingFeeMonth] = useState('');
    const [signDate, setSignDate] = useState(new Date().toISOString().split('T')[0]);
    const [effectiveDate, setEffectiveDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [status, setStatus] = useState('执行中');
    const [autoRenew, setAutoRenew] = useState(false);
    const [invoiceRule, setInvoiceRule] = useState('');
    const [remark, setRemark] = useState('');
    const [previousContractId, setPreviousContractId] = useState('');
    const [isCurrent, setIsCurrent] = useState(true);

    const [customers, setCustomers] = useState<{ id: string, company_name: string }[]>([]);

    useEffect(() => {
        // Fetch simple customer list for dropdown
        fetch('/api/customers?limit=1000') // Adjusting limit to ensure most show, or ideally a dedicated dropdown API
            .then(res => res.json())
            .then(data => setCustomers(data.data || []))
            .catch(console.error);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerId || !contractNo || !contractName || !totalContractAmount) {
            setError('请填写所有带*的必填项');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const formData = {
                customer_id: customerId,
                contract_no: contractNo,
                contract_name: contractName,
                contract_type: contractType,
                start_date: startDate || null,
                end_date: endDate || null,
                status: status,
                sign_date: signDate || null,
                effective_date: effectiveDate || null,
                auto_renew: autoRenew,
                pay_cycle_months: payCycleMonths,
                billing_fee_month: billingFeeMonth,
                standard_price: standardPrice,
                discount_amount: discountAmount,
                deposit_amount: depositAmount,
                total_contract_amount: totalContractAmount,
                invoice_rule: invoiceRule,
                remark: remark,
                previous_contract_id: previousContractId,
                is_current: isCurrent
            };

            const res = await fetch('/api/contracts/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '创建失败');
            }

            // Return to contract list
            router.push('/resources/contracts');
        } catch (err: any) {
            setError(err.message);
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-auto">
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    <form id="new-contract-form" onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="px-6 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                    <FileSignature className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-slate-900">合同信息录入</h1>
                                    <p className="text-sm text-slate-500 mt-1">
                                        为签约客户建立一份新的正式服务合同档案。
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => router.push('/resources/contracts')}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors bg-white border border-slate-200"
                                >
                                    <X className="w-4 h-4" />
                                    返回合同列表
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    {submitting ? '保存中...' : '提交合同'}
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
                                <h2 className="text-lg font-semibold text-slate-800">合同与款项属性</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">归属客户 <span className="text-red-500">*</span></label>
                                    <Select
                                        options={customers.map(c => ({ value: c.id, label: c.company_name }))}
                                        value={customerId ? { value: customerId, label: customers.find(c => c.id === customerId)?.company_name } : null}
                                        onChange={(selectedOption) => setCustomerId(selectedOption ? selectedOption.value : '')}
                                        placeholder="-- 请选择签约客户 --"
                                        isClearable
                                        isSearchable
                                        noOptionsMessage={() => '未找到该客户'}
                                        styles={{
                                            control: (base, state) => ({
                                                ...base,
                                                borderRadius: '0.75rem',
                                                borderColor: state.isFocused ? '#2563eb' : '#e2e8f0',
                                                boxShadow: state.isFocused ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'none',
                                                padding: '2px 0',
                                                minHeight: '44px',
                                                '&:hover': {
                                                    borderColor: state.isFocused ? '#2563eb' : '#cbd5e1'
                                                }
                                            }),
                                            option: (base, state) => ({
                                                ...base,
                                                backgroundColor: state.isSelected ? '#dbeafe' : state.isFocused ? '#eff6ff' : 'white',
                                                color: state.isSelected ? '#1d4ed8' : '#0f172a',
                                                cursor: 'pointer'
                                            })
                                        }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">合同编号 <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={contractNo}
                                        onChange={e => setContractNo(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="如：HT-202X-001"
                                        required
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">合同名称 <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={contractName}
                                        onChange={e => setContractName(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="如：202X年度系统维护服务合同"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">合同类型</label>
                                    <select
                                        value={contractType}
                                        onChange={e => setContractType(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white"
                                    >
                                        <option value="一般合同">一般合同</option>
                                        <option value="代理记账">代理记账</option>
                                        <option value="工商代办">工商代办</option>
                                        <option value="系统开发">系统开发</option>
                                        <option value="其他">其他</option>
                                    </select>
                                </div>

                                <div className="flex items-center space-x-2 pt-6">
                                    <input
                                        type="checkbox"
                                        id="autoRenew"
                                        checked={autoRenew}
                                        onChange={e => setAutoRenew(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <label htmlFor="autoRenew" className="text-sm font-medium text-slate-700">启用自动续约</label>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">合同总金额 (元) <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={totalContractAmount}
                                        onChange={e => setTotalContractAmount(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">标准报价/指导价 (元)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={standardPrice}
                                        onChange={e => setStandardPrice(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">折扣总金额 (元)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={discountAmount}
                                        onChange={e => setDiscountAmount(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">押金/保证金 (元)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={depositAmount}
                                        onChange={e => setDepositAmount(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">收款周期 (月)</label>
                                    <select
                                        value={payCycleMonths}
                                        onChange={e => setPayCycleMonths(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white"
                                    >
                                        <option value="">跟随项目支付</option>
                                        <option value="1">月付 (1个月)</option>
                                        <option value="3">季付 (3个月)</option>
                                        <option value="6">半年付 (6个月)</option>
                                        <option value="12">年付 (12个月)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">月均记账费 (若为代账合同)</label>
                                    <input
                                        type="text"
                                        value={billingFeeMonth}
                                        onChange={e => setBillingFeeMonth(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="如：200"
                                    />
                                </div>

                                <div className="md:col-span-2 mt-4 mb-2 pb-2 border-b border-slate-100">
                                    <h2 className="text-lg font-semibold text-slate-800">日期与状态设置</h2>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">签订日期</label>
                                    <input
                                        type="date"
                                        value={signDate}
                                        onChange={e => setSignDate(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">正式生效日期</label>
                                    <input
                                        type="date"
                                        value={effectiveDate}
                                        onChange={e => setEffectiveDate(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">服务开始日期</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">服务结束日期</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">开票规则与说明</label>
                                    <input
                                        type="text"
                                        value={invoiceRule}
                                        onChange={e => setInvoiceRule(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="如：普票/专票，开票节点等"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">续签的原合同ID (如适用)</label>
                                    <input
                                        type="text"
                                        value={previousContractId}
                                        onChange={e => setPreviousContractId(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                                        placeholder="原合同的系统ID"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">履约状态</label>
                                    <select
                                        value={status}
                                        onChange={e => setStatus(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white"
                                    >
                                        <option value="执行中">执行中</option>
                                        <option value="已归档">已归档</option>
                                        <option value="已终止">已终止</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">合同内部备注</label>
                                    <textarea
                                        value={remark}
                                        onChange={e => setRemark(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all min-h-[100px]"
                                        placeholder="其他条款或内部备注信息..."
                                    />
                                </div>

                                <div className="md:col-span-2 flex items-center space-x-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="isCurrent"
                                        checked={isCurrent}
                                        onChange={e => setIsCurrent(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <label htmlFor="isCurrent" className="text-sm font-medium text-slate-700">设为当前生效主合同 (勾选后其他同类合同将退居历史)</label>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
