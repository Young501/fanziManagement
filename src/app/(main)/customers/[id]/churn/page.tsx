'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, UserMinus } from 'lucide-react';

export default function ChurnRegistrationPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);

    const [customerName, setCustomerName] = useState('...');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [churnReason, setChurnReason] = useState('');
    const [churnDate, setChurnDate] = useState(new Date().toISOString().split('T')[0]);
    const [competitorInfo, setCompetitorInfo] = useState('');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetch(`/api/customers/${id}`)
            .then(res => res.json())
            .then(res => {
                if (res.error) throw new Error(res.error);
                if (res.customer) setCustomerName(res.customer.company_name);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!churnReason) {
            setError('请选择或填写流失核心原因');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const formData = {
                customer_id: id,
                churn_reason: churnReason,
                churn_date: churnDate,
                competitor_info: competitorInfo,
                remarks: remarks,
            };

            const res = await fetch(`/api/customers/${id}/churn`, {
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
        <div className="flex flex-col h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">客户流失登记</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            为客户 <span className="font-semibold text-slate-700">{customerName}</span> 提交流失记录并归档。
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors bg-white border border-slate-200"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
                    >
                        <UserMinus className="w-4 h-4" />
                        {submitting ? '提交中...' : '确认流失'}
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-6">
                <div className="max-w-3xl mx-auto">
                    {error && (
                        <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm flex items-center justify-between">
                            <span>{error}</span>
                            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">×</button>
                        </div>
                    )}

                    <form id="churn-form" onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
                        <div className="p-6 border-b border-red-50 bg-red-50/30">
                            <h2 className="text-lg font-semibold text-red-800">流失详情调查</h2>
                            <p className="text-sm text-red-600/80 mt-1">提交后，该客户状态将自动更新为“流失”。</p>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">流失类别及原因 <span className="text-red-500">*</span></label>
                                <select
                                    value={churnReason}
                                    onChange={e => setChurnReason(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all bg-white"
                                    required
                                >
                                    <option value="">请选择主要原因</option>
                                    <option value="服务质量及态度">服务不满意 (质量/响应慢等)</option>
                                    <option value="价格因素">价格因素 (太贵/竞品价格更低)</option>
                                    <option value="业务需求变化">业务需求变化 (公司倒闭/不再需要此服务)</option>
                                    <option value="竞品竞争流失">转用竞品</option>
                                    <option value="其他">其他原因</option>
                                </select>
                            </div>

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
                                <label className="block text-sm font-medium text-slate-700 mb-1">转向的竞品信息（选填）</label>
                                <input
                                    type="text"
                                    value={competitorInfo}
                                    onChange={e => setCompetitorInfo(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                                    placeholder="如已知客户转投哪家服务商，请填写"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">详细流失情况说明</label>
                                <textarea
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all min-h-[120px]"
                                    placeholder="请描述客户流失前后的沟通记录或具体痛楚，便于后续复盘..."
                                />
                            </div>

                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
