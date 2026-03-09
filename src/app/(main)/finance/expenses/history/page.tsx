'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { History, Trash2, ArrowLeft, Loader2, AlertCircle, ImageIcon, ExternalLink, X, TrendingDown, Filter } from 'lucide-react';

const EXPENSE_CATEGORIES = ['办公费', '交通费', '社保公积金', '工资', '税费', '外包服务费', '其他'];

export default function ExpenseHistoryPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [count, setCount] = useState(0);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [role, setRole] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Filters
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    const limit = 20;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            if (selectedMonth) params.set('month', selectedMonth);
            if (selectedCategory) params.set('category', selectedCategory);
            const res = await fetch(`/api/finance/expenses/history?${params.toString()}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json.data || []);
            setCount(json.count || 0);
            setTotal(json.total || 0);
            setRole(json.role);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page, selectedMonth, selectedCategory]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Reset to page 1 when filters change
    const handleMonthChange = (val: string) => {
        setSelectedMonth(val);
        setPage(1);
    };
    const handleCategoryChange = (val: string) => {
        setSelectedCategory(val === selectedCategory ? '' : val);
        setPage(1);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('确定要删除这条成本记录吗？\n此操作不可撤销。')) return;

        setDeleteLoading(id);
        try {
            const res = await fetch(`/api/finance/expenses/history?id=${id}`, {
                method: 'DELETE'
            });
            const json = await res.json();
            if (json.error) throw new Error(json.error);

            setData(prev => prev.filter(item => item.id !== id));
            setCount(prev => prev - 1);
            setTotal(prev => {
                const deleted = data.find(d => d.id === id);
                return prev - (deleted?.expense_amount || 0);
            });
        } catch (err: any) {
            alert(err.message);
        } finally {
            setDeleteLoading(null);
        }
    };

    const formatCurrency = (val: number | null | undefined) => {
        if (val == null) return '¥0.00';
        return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);
    };

    const categoryColors: Record<string, { bg: string; text: string }> = {
        '办公费': { bg: 'bg-blue-50', text: 'text-blue-600' },
        '交通费': { bg: 'bg-cyan-50', text: 'text-cyan-600' },
        '社保公积金': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
        '工资': { bg: 'bg-indigo-50', text: 'text-indigo-600' },
        '税费': { bg: 'bg-amber-50', text: 'text-amber-600' },
        '外包服务费': { bg: 'bg-purple-50', text: 'text-purple-600' },
        '其他': { bg: 'bg-slate-100', text: 'text-slate-600' },
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/finance/expenses')}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                            <History className="w-6 h-6 text-violet-600" />
                            成本历史记录
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">查看公司成本支出明细，核对费用凭证及备注信息。</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Summary Card */}
            <div className="bg-gradient-to-br from-violet-600 to-violet-700 rounded-2xl p-5 text-white shadow-md">
                <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-5 h-5 text-violet-200" />
                    <span className="text-sm text-violet-200 font-medium">
                        {selectedMonth ? `${selectedMonth} 总支出` : '全部总支出'}
                        {selectedCategory ? ` · ${selectedCategory}` : ''}
                    </span>
                </div>
                <div className="text-3xl font-bold tracking-tight">
                    {loading ? <span className="opacity-50 text-xl">计算中...</span> : formatCurrency(total)}
                </div>
                <div className="mt-1 text-violet-200 text-xs">共 {count} 条记录</div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Filter className="w-4 h-4" />
                    筛选
                </div>
                <div className="flex flex-wrap gap-4 items-center">
                    {/* Month picker */}
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-500 whitespace-nowrap">按月份</label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={e => handleMonthChange(e.target.value)}
                            className="rounded-xl border border-slate-200 py-1.5 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                        />
                        {selectedMonth && (
                            <button
                                onClick={() => handleMonthChange('')}
                                className="text-xs text-slate-400 hover:text-slate-600 underline"
                            >
                                清除
                            </button>
                        )}
                    </div>

                    {/* Category filter pills */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-500 whitespace-nowrap">费用类别</span>
                        <button
                            onClick={() => { setSelectedCategory(''); setPage(1); }}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedCategory === '' ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            全部
                        </button>
                        {EXPENSE_CATEGORIES.map(cat => {
                            const color = categoryColors[cat] || categoryColors['其他'];
                            const isActive = selectedCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => handleCategoryChange(cat)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${isActive ? `${color.bg} ${color.text} ring-2 ring-offset-1 ring-current shadow-sm` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    {cat}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200">
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">日期</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">客户</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">金额</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">类别</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">类型</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">供应商</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">付款方式</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">凭证</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider w-20">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 relative">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="py-20 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto" />
                                        <p className="text-slate-400 mt-2">加载数据中...</p>
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-20 text-center text-slate-500">
                                        {selectedMonth || selectedCategory ? '当前筛选条件下暂无记录' : '暂无成本记录'}
                                    </td>
                                </tr>
                            ) : (
                                data.map((item) => {
                                    const catColor = categoryColors[item.expense_category] || categoryColors['其他'];
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 px-4 text-slate-500 whitespace-nowrap text-center">
                                                {item.expense_date}
                                            </td>
                                            <td className="py-4 px-4 font-medium text-slate-900 text-center">
                                                {item.customers?.company_name || <span className="text-slate-400">-</span>}
                                            </td>
                                            <td className="py-4 px-4 text-center font-bold text-red-600 font-mono">
                                                {formatCurrency(item.expense_amount)}
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${catColor.bg} ${catColor.text}`}>
                                                    {item.expense_category}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-slate-600 text-center">
                                                {item.expense_type || <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="py-4 px-4 text-slate-600 text-center">
                                                {item.vendor_name || <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="py-4 px-4 text-slate-600 text-center">
                                                {item.payment_method || <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                {item.attachment ? (
                                                    <button
                                                        onClick={() => setPreviewImage(item.attachment)}
                                                        className="p-1.5 bg-slate-100 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all mx-auto"
                                                        title="查看凭证"
                                                    >
                                                        <ImageIcon className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                {role === 'admin' && (
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        disabled={deleteLoading === item.id}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="删除记录"
                                                    >
                                                        {deleteLoading === item.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {count > limit && (
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                        <div className="text-sm text-slate-500">
                            共 {count} 条记录
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50"
                            >
                                上一页
                            </button>
                            <span className="px-3 py-1 text-sm font-medium">第 {page} 页</span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page * limit >= count}
                                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50"
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-violet-500" />
                                费用凭证预览
                            </h3>
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50/50">
                            <img
                                src={previewImage}
                                alt="Expense Attachment"
                                className="max-w-full h-auto object-contain rounded-lg"
                            />
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
                            <a
                                href={previewImage}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-all"
                            >
                                <ExternalLink className="w-4 h-4" />
                                查看原图
                            </a>
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
