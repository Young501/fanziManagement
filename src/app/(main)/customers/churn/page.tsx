'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserMinus, AlertCircle, X, History, Trash2, Loader2 } from 'lucide-react';
import Select from 'react-select';

export default function ChurnRegistrationPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

    const [customers, setCustomers] = useState<{ id: string, company_name: string }[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    // Form State
    const [churnType, setChurnType] = useState('');
    const [churnReason, setChurnReason] = useState('');
    const [churnDate, setChurnDate] = useState(new Date().toISOString().split('T')[0]);
    const [lastServiceDate, setLastServiceDate] = useState('');
    const [note, setNote] = useState('');

    // History State
    const [records, setRecords] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const limit = 10;

    useEffect(() => {
        setLoading(true);
        fetch('/api/customers?limit=1000')
            .then(res => res.json())
            .then(data => {
                if (data.data) {
                    setCustomers(data.data);
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));

        // Check user role
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => setUserRole(data.role || 'user'))
            .catch(() => {
                fetch('/api/profile')
                    .then(res => res.json())
                    .then(data => setUserRole(data.data?.role))
                    .catch(console.error);
            });
    }, []);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, page]);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/customers/churn/history?page=${page}&limit=${limit}`);
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
            const res = await fetch(`/api/customers/churn/history?id=${id}`, {
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
        if (!selectedCustomerId || !churnReason) {
            setError('请选择客户并填写流失核心原因');
            return;
        }

        if (!confirm('请确认流失登记信息填写无误。\n\n提交后该客户状态将自动更新为“流失”，确定提交吗？')) {
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

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                setActiveTab('history');
            }, 3000);

            // Reset form
            setSelectedCustomerId('');
            setChurnType('');
            setChurnReason('');
            setNote('');
            setSubmitting(false);
        } catch (err: any) {
            setError(err.message);
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">加载中...</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-auto">
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header with Tabs */}
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-50 text-red-600 rounded-2xl shadow-sm">
                                <UserMinus className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">流失客户</h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    登记客户流失信息并查看历史记录
                                </p>
                            </div>
                        </div>

                        <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200">
                            <button
                                onClick={() => setActiveTab('form')}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'form'
                                    ? 'bg-white text-red-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                <UserMinus className="w-4 h-4" />
                                客户流失登记
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'history'
                                    ? 'bg-white text-red-600 shadow-sm'
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
                                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">流失登记表单</span>
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
                                        className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
                                    >
                                        <UserMinus className="w-4 h-4" />
                                        {submitting ? '提交中...' : '确认并登记'}
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 sm:p-8 relative">
                                {showSuccess && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 backdrop-blur-sm transition-all duration-500 rounded-2xl">
                                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
                                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-800">流失登记成功</h3>
                                            <p className="text-slate-500 mt-1">记录已成功存档，正在跳转...</p>
                                        </div>
                                    </div>
                                )}

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
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
                            {loadingHistory ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-20">
                                    <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
                                    <p className="text-slate-500 font-medium">加载中...</p>
                                </div>
                            ) : records.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-20">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <History className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-slate-900 font-semibold text-lg">暂无流失记录</h3>
                                    <p className="text-slate-500 mt-1 max-w-xs text-center">
                                        目前系统内没有历史流失客户的登记记录。
                                    </p>
                                    <button
                                        onClick={() => setActiveTab('form')}
                                        className="mt-6 text-red-600 font-medium hover:underline"
                                    >
                                        立即登记
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto flex-1">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">客户名称</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">流失日期</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">最后服务</th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">流失原因</th>
                                                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {records.map((record) => (
                                                    <tr key={record.id} className="hover:bg-slate-50/30 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="font-medium text-slate-900">{record.company_name || '未知客户'}</div>
                                                            <div className="text-xs text-slate-400 mt-0.5">{record.churn_type}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-600">
                                                            {new Date(record.churn_date).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-600">
                                                            {record.last_service_date ? new Date(record.last_service_date).toLocaleDateString() : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={record.churn_reason}>
                                                            {record.churn_reason}
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
                                            共 <span className="font-medium">{total}</span> 条记录
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
