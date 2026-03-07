'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserMinus, AlertCircle, X } from 'lucide-react';
import Select from 'react-select';

export default function ChurnRegistrationPage() {
    const router = useRouter();

    const [customers, setCustomers] = useState<{ id: string, company_name: string }[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [churnType, setChurnType] = useState('');
    const [churnReason, setChurnReason] = useState('');
    const [churnDate, setChurnDate] = useState(new Date().toISOString().split('T')[0]);
    const [lastServiceDate, setLastServiceDate] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        setLoading(true);
        fetch('/api/customers?limit=1000') // Assume GET /api/customers works for basic list fetch as seen in old files
            .then(res => res.json())
            .then(data => {
                if (data.data) {
                    setCustomers(data.data);
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomerId || !churnReason) {
            setError('请选择客户并填写流失核心原因');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const formData = {
                customer_id: selectedCustomerId,
                churn_type: churnType,
                churn_reason: churnReason,
                churn_date: churnDate,
                last_service_date: lastServiceDate,
                note: note,
            };

            const res = await fetch(`/api/customers/${selectedCustomerId}/churn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '登记失败');
            }

            // Return to customer list upon successful churn logging
            router.push('/customers');
        } catch (err: any) {
            setError(err.message);
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">加载中...</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-auto">
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    <form id="churn-form" onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="px-6 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-slate-900">客户流失登记</h1>
                                    <p className="text-sm text-slate-500 mt-1">
                                        为系统中的客户提交流失原因与竞品去向归档。
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
                                    className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
                                >
                                    <UserMinus className="w-4 h-4" />
                                    {submitting ? '提交中...' : '确认流失'}
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
                                <h2 className="text-lg font-semibold text-slate-800">流失详情调查</h2>
                                <p className="text-sm text-slate-500 mt-1">提交后，该客户状态将自动更新为“流失”。</p>
                            </div>

                            <div className="grid grid-cols-1 gap-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">流失客户 <span className="text-red-500">*</span></label>
                                    <Select
                                        options={customers.map(c => ({ value: c.id, label: c.company_name }))}
                                        value={selectedCustomerId ? { value: selectedCustomerId, label: customers.find(c => c.id === selectedCustomerId)?.company_name } : null}
                                        onChange={(selectedOption) => setSelectedCustomerId(selectedOption ? selectedOption.value : '')}
                                        placeholder="-- 请选择要登记流失的客户 --"
                                        isClearable
                                        isSearchable
                                        noOptionsMessage={() => '未找到该客户'}
                                        styles={{
                                            control: (base, state) => ({
                                                ...base,
                                                borderRadius: '0.75rem',
                                                borderColor: state.isFocused ? '#ef4444' : '#e2e8f0',
                                                boxShadow: state.isFocused ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : 'none',
                                                padding: '2px 0',
                                                minHeight: '44px',
                                                '&:hover': {
                                                    borderColor: state.isFocused ? '#ef4444' : '#cbd5e1'
                                                }
                                            }),
                                            option: (base, state) => ({
                                                ...base,
                                                backgroundColor: state.isSelected ? '#fee2e2' : state.isFocused ? '#fef2f2' : 'white',
                                                color: state.isSelected ? '#991b1b' : '#0f172a',
                                                cursor: 'pointer'
                                            })
                                        }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">流失类别 <span className="text-red-500">*</span></label>
                                    <select
                                        value={churnType}
                                        onChange={e => setChurnType(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-white"
                                        required
                                    >
                                        <option value="">请选择流失类别</option>
                                        <option value="服务质量及态度">服务质量及态度</option>
                                        <option value="价格因素">价格因素</option>
                                        <option value="业务转行/停业">业务转行/倒闭/停业</option>
                                        <option value="竞品抢单">竞品抢单</option>
                                        <option value="其他">其他</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">具体流失原因细项 <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={churnReason}
                                        onChange={e => setChurnReason(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                                        placeholder="请简述导致流失的核心原因或触发事件"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">确切流失日期 <span className="text-red-500">*</span></label>
                                        <input
                                            type="date"
                                            value={churnDate}
                                            onChange={e => setChurnDate(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">最后服务日期</label>
                                        <input
                                            type="date"
                                            value={lastServiceDate}
                                            onChange={e => setLastServiceDate(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">详细流失情况与竞品说明</label>
                                    <textarea
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all min-h-[120px]"
                                        placeholder="请描述客户流失前后的沟通记录、竞品特征及其它痛楚，便于后续复盘回访..."
                                    />
                                </div>

                            </div>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
