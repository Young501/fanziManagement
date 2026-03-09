'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { History, Trash2, ArrowLeft, Loader2, AlertCircle, Banknote, ImageIcon, ExternalLink, X, Edit2, FileText } from 'lucide-react';

const PAYMENT_METHODS = ['转账', '微信支付', '支付宝', '现金', '银行汇款', '其他'];

export default function PaymentHistoryPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(1);
    const [role, setRole] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Edit state
    const [editRecord, setEditRecord] = useState<any | null>(null);
    const [editForm, setEditForm] = useState({
        paid_at: '',
        paid_amount: '',
        negotiated_discount_amount: '',
        method: '',
        note: ''
    });
    const [editSubmitting, setEditSubmitting] = useState(false);

    const limit = 20;

    useEffect(() => {
        fetchData();
    }, [page]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/finance/payment/history?page=${page}&limit=${limit}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json.data || []);
            setCount(json.count || 0);
            setRole(json.role);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('确定要删除这条收款记录吗？\n删除后系统将尝试回退对应账单的已收金额。此操作不可撤销。')) return;

        setDeleteLoading(id);
        try {
            const res = await fetch(`/api/finance/payment/history?id=${id}`, {
                method: 'DELETE'
            });
            const json = await res.json();
            if (json.error) throw new Error(json.error);

            // Remove from local state
            setData(prev => prev.filter(item => item.id !== id));
            setCount(prev => prev - 1);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setDeleteLoading(null);
        }
    };

    const openEdit = (record: any) => {
        setEditRecord(record);
        setEditForm({
            paid_at: record.paid_at || '',
            paid_amount: record.paid_amount?.toString() || '0',
            negotiated_discount_amount: record.negotiated_discount_amount?.toString() || '0',
            method: record.method || '微信支付',
            note: record.note || ''
        });
    };

    const handleEditSubmit = async () => {
        if (!editRecord) return;
        setEditSubmitting(true);
        try {
            const res = await fetch(`/api/finance/payment/history`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editRecord.id,
                    paid_at: editForm.paid_at,
                    paid_amount: parseFloat(editForm.paid_amount) || 0,
                    negotiated_discount_amount: parseFloat(editForm.negotiated_discount_amount) || 0,
                    method: editForm.method,
                    note: editForm.note
                })
            });
            const json = await res.json();
            if (json.error) throw new Error(json.error);

            // Update local state
            setData(prev => prev.map(item => {
                if (item.id === editRecord.id) {
                    return {
                        ...item,
                        paid_at: editForm.paid_at,
                        paid_amount: parseFloat(editForm.paid_amount) || 0,
                        negotiated_discount_amount: parseFloat(editForm.negotiated_discount_amount) || 0,
                        method: editForm.method,
                        note: editForm.note
                    };
                }
                return item;
            }));
            setEditRecord(null);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setEditSubmitting(false);
        }
    };

    const formatCurrency = (val: number | null | undefined) => {
        if (val == null) return '¥0.00';
        return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/finance/payment')}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                            <History className="w-6 h-6 text-emerald-600" />
                            收款历史记录
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">查看财务收款明细，核对回款凭证及备注信息。</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200">
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">收款日期</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">客户名称</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">收款金额</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">优惠金额</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">收款方式</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">类型</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider">凭证</th>
                                <th className="py-3 px-4 text-center font-semibold text-slate-600 uppercase tracking-wider w-20">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 relative">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
                                        <p className="text-slate-400 mt-2">加载数据中...</p>
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center text-slate-500">
                                        暂无收款记录
                                    </td>
                                </tr>
                            ) : (
                                data.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-4 text-slate-500 whitespace-nowrap text-center">
                                            {item.paid_at}
                                        </td>
                                        <td className="py-4 px-4 font-medium text-slate-900 text-center">
                                            {item.customers?.company_name || '未知客户'}
                                        </td>
                                        <td className="py-4 px-4 text-center font-bold text-emerald-600 font-mono">
                                            {formatCurrency(item.paid_amount)}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            {item.negotiated_discount_amount > 0 ? (
                                                <span className="text-orange-600 font-semibold font-mono">
                                                    -{formatCurrency(item.negotiated_discount_amount)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-4 text-slate-600 text-center">
                                            {item.method || '-'}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            {item.company_receivables?.billing_fee_month ? (
                                                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">
                                                    月费收款
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-xs">
                                                    一次性收款
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            {item.screenshot ? (
                                                <button
                                                    onClick={() => setPreviewImage(item.screenshot)}
                                                    className="p-1.5 bg-slate-100 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all mx-auto"
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
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => openEdit(item)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="修改记录"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
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
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
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
                                <ImageIcon className="w-5 h-5 text-blue-500" />
                                收款凭证预览
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
                                alt="Payment Screenshot"
                                className="max-w-full h-auto object-contain rounded-lg"
                            />
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
                            <a
                                href={previewImage}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all"
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
            {/* Edit Modal */}
            {editRecord && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <Edit2 className="w-5 h-5 text-blue-500" />
                                修改收款记录
                            </h3>
                            <button
                                onClick={() => setEditRecord(null)}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">收款日期</label>
                                <input
                                    type="date"
                                    value={editForm.paid_at}
                                    onChange={e => setEditForm(prev => ({ ...prev, paid_at: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <Banknote className="w-4 h-4 text-emerald-500" />
                                    收款金额
                                </label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">¥</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editForm.paid_amount}
                                        onChange={e => setEditForm(prev => ({ ...prev, paid_amount: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors text-sm font-mono"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-slate-500">修改收款金额会自动调整对应账单的已收金额</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">优惠金额</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">¥</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editForm.negotiated_discount_amount}
                                        onChange={e => setEditForm(prev => ({ ...prev, negotiated_discount_amount: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors text-sm font-mono"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">收款方式</label>
                                <select
                                    value={editForm.method}
                                    onChange={e => setEditForm(prev => ({ ...prev, method: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white transition-colors text-sm"
                                >
                                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    备注
                                </label>
                                <input
                                    type="text"
                                    value={editForm.note}
                                    onChange={e => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                                    placeholder="选填"
                                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors text-sm"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                            <button
                                onClick={() => setEditRecord(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-xl transition-all"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleEditSubmit}
                                disabled={editSubmitting}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                保存修改
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
