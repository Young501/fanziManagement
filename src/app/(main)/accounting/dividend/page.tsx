'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Building2, TrendingUp, TrendingDown, Wallet, Users, CheckCircle2,
    Loader2, AlertCircle, ChevronDown, History, BarChart3, Edit3
} from 'lucide-react';

const SHAREHOLDERS = [
    { name: '王俊霞', defaultRatio: 0.60 },
    { name: '杨懿宇', defaultRatio: 0.20 },
    { name: '杨泽辰', defaultRatio: 0.20 },
];

function formatCurrency(val: number | null | undefined) {
    if (val == null) return '¥0.00';
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);
}

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

type ShareholderRow = {
    name: string;
    ratio: number; // 0-1
    amount: number;
    note: string;
};

type BatchDetail = {
    shareholder_name: string;
    ratio: number;
    dividend_amount: number;
    is_paid: boolean;
    paid_at: string | null;
    note: string | null;
};

type Batch = {
    id: string;
    dividend_month: string;
    based_on_revenue: number;
    based_on_cost: number;
    based_on_profit: number;
    total_dividend_amount: number;
    status: string;
    note: string | null;
    created_by: string;
    created_at: string;
};

export default function DividendPage() {
    // --- 当月核算 state ---
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summary, setSummary] = useState<{ revenue: number; cost: number; profit: number } | null>(null);
    const [totalDividend, setTotalDividend] = useState('');
    const [rows, setRows] = useState<ShareholderRow[]>(
        SHAREHOLDERS.map(s => ({ name: s.name, ratio: s.defaultRatio, amount: 0, note: '' }))
    );
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // --- 历史记录 state ---
    const [historyLoading, setHistoryLoading] = useState(false);
    const [allBatches, setAllBatches] = useState<Batch[]>([]);
    const [allDetailsHistory, setAllDetailsHistory] = useState<any[]>([]);
    const [statsYear, setStatsYear] = useState<string>(new Date().getFullYear().toString());
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
    const [selectedBatchDetails, setSelectedBatchDetails] = useState<BatchDetail[]>([]);
    const [existingBatch, setExistingBatch] = useState<Batch | null>(null);
    const [existingDetails, setExistingDetails] = useState<BatchDetail[]>([]);

    // Memoized calculation for statistics
    const [computedTotals, setComputedTotals] = useState<{ global: number; perPerson: Record<string, number> }>({
        global: 0,
        perPerson: {}
    });

    useEffect(() => {
        const filteredBatches = statsYear === 'all' 
            ? allBatches 
            : allBatches.filter(b => b.dividend_month.startsWith(statsYear));
            
        const global = filteredBatches.reduce((s, b) => s + (Number(b.total_dividend_amount) || 0), 0);
        
        const perPerson: Record<string, number> = {};
        const filteredDetails = statsYear === 'all'
            ? allDetailsHistory
            : allDetailsHistory.filter(d => (d.dividend_batches?.dividend_month || '').startsWith(statsYear));

        filteredDetails.forEach(d => {
            perPerson[d.shareholder_name] = (perPerson[d.shareholder_name] || 0) + (Number(d.dividend_amount) || 0);
        });

        setComputedTotals({ global, perPerson });
    }, [statsYear, allBatches, allDetailsHistory]);

    // Fetch finance summary for selected month
    const fetchSummary = useCallback(async (month: string) => {
        setSummaryLoading(true);
        try {
            const res = await fetch(`/api/accounting/dividend/finance-summary?month=${month}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setSummary(json);
            // Default dividend = profit
            const profit = json.profit || 0;
            setTotalDividend(profit > 0 ? profit.toFixed(2) : '0.00');
            // Recalc rows
            setRows(SHAREHOLDERS.map(s => ({
                name: s.name,
                ratio: s.defaultRatio,
                amount: parseFloat((profit * s.defaultRatio).toFixed(2)),
                note: ''
            })));

            // Set default overall note
            if (month) {
                const [year, m] = month.split('-');
                setNote(`${year}年${parseInt(m)}月分红通过微信转账结清`);
            }
        } catch (e: any) {
            setSummary(null);
        } finally {
            setSummaryLoading(false);
        }
    }, []);

    // Fetch existing batch for selected month + history
    const fetchHistory = useCallback(async (month: string) => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/accounting/dividend?month=${month}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setExistingBatch(json.batch || null);
            setExistingDetails(json.details || []);
            setAllBatches(json.allBatches || []);
            setAllDetailsHistory(json.allDetails || []);
        } catch (e: any) {
            console.error(e);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSummary(selectedMonth);
        fetchHistory(selectedMonth);
        setSubmitSuccess(false);
        setSubmitError(null);
        setNote('');
    }, [selectedMonth, fetchSummary, fetchHistory]);

    // When totalDividend changes, recalc amounts proportionally
    const handleTotalChange = (val: string) => {
        setTotalDividend(val);
        const total = parseFloat(val) || 0;
        setRows(prev => prev.map(r => ({
            ...r,
            amount: parseFloat((total * r.ratio).toFixed(2))
        })));
    };

    // When a ratio changes, recalc this row's amount
    const handleRatioChange = (idx: number, val: string) => {
        const ratio = Math.min(1, Math.max(0, parseFloat(val) / 100 || 0));
        const total = parseFloat(totalDividend) || 0;
        setRows(prev => prev.map((r, i) => i === idx
            ? { ...r, ratio, amount: parseFloat((total * ratio).toFixed(2)) }
            : r
        ));
    };

    // When an amount changes manually
    const handleAmountChange = (idx: number, val: string) => {
        setRows(prev => prev.map((r, i) => i === idx
            ? { ...r, amount: parseFloat(val) || 0 }
            : r
        ));
    };

    // When an individual note changes
    const handleIndividualNoteChange = (idx: number, val: string) => {
        setRows(prev => prev.map((r, i) => i === idx
            ? { ...r, note: val }
            : r
        ));
    };

    const handleConfirm = async () => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await fetch('/api/accounting/dividend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dividend_month: selectedMonth,
                    based_on_revenue: summary?.revenue || 0,
                    based_on_cost: summary?.cost || 0,
                    based_on_profit: summary?.profit || 0,
                    total_dividend_amount: parseFloat(totalDividend) || 0,
                    note: note || null,
                    details: rows.map(r => ({
                        shareholder_name: r.name,
                        ratio: r.ratio,
                        dividend_amount: r.amount,
                        note: r.note || null,
                    })),
                }),
            });
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setSubmitSuccess(true);
            setConfirmOpen(false);
            // Refresh
            fetchHistory(selectedMonth);
        } catch (e: any) {
            setSubmitError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const ratioSum = rows.reduce((s, r) => s + r.ratio, 0);
    const amountSum = rows.reduce((s, r) => s + r.amount, 0);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 rounded-xl ring-1 ring-amber-100">
                    <Building2 className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">股东分红</h1>
                    <p className="text-slate-500 text-sm mt-0.5">按月核算财务数据，记录股东分红</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                {/* ── Left Panel: 当月核算 ── */}
                <div className="xl:col-span-3 space-y-5">
                    {/* Month Picker */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-amber-500" /> 当月核算
                            </h2>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(e.target.value)}
                                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>

                        {/* Finance Summary */}
                        {summaryLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
                        ) : summary && (
                            <div className="grid grid-cols-3 gap-3 mb-5">
                                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                                    <div className="flex items-center justify-center gap-1 text-emerald-600 mb-1">
                                        <TrendingUp className="w-4 h-4" />
                                        <span className="text-xs font-semibold">总收款</span>
                                    </div>
                                    <div className="text-lg font-bold text-emerald-700 font-mono">{formatCurrency(summary.revenue)}</div>
                                </div>
                                <div className="bg-rose-50 rounded-xl p-4 text-center">
                                    <div className="flex items-center justify-center gap-1 text-rose-600 mb-1">
                                        <TrendingDown className="w-4 h-4" />
                                        <span className="text-xs font-semibold">总成本</span>
                                    </div>
                                    <div className="text-lg font-bold text-rose-700 font-mono">{formatCurrency(summary.cost)}</div>
                                </div>
                                <div className="bg-amber-50 rounded-xl p-4 text-center">
                                    <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
                                        <Wallet className="w-4 h-4" />
                                        <span className="text-xs font-semibold">净利润</span>
                                    </div>
                                    <div className="text-lg font-bold text-amber-700 font-mono">{formatCurrency(summary.profit)}</div>
                                </div>
                            </div>
                        )}

                        {/* If already confirmed for this month */}
                        {existingBatch ? (
                            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    <span className="font-semibold text-emerald-800">本月分红已确认</span>
                                    <span className="ml-auto text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{existingBatch.status}</span>
                                </div>
                                <div className="text-sm text-emerald-800 mb-3">
                                    实际分红总额：<strong className="font-mono text-base">{formatCurrency(existingBatch.total_dividend_amount)}</strong>
                                    {existingBatch.note && <span className="ml-3 text-emerald-600">· {existingBatch.note}</span>}
                                </div>
                                <div className="space-y-2">
                                    {existingDetails.map(d => (
                                        <div key={d.shareholder_name} className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
                                            <span className="font-medium text-slate-700">{d.shareholder_name}</span>
                                            <span className="text-xs text-slate-400">{(d.ratio * 100).toFixed(0)}%</span>
                                            <span className="font-bold text-emerald-700 font-mono">{formatCurrency(d.dividend_amount)}</span>
                                        </div>
                                    ))}
                                </div>
                                {existingBatch.note && (
                                    <p className="mt-3 text-xs text-slate-500">备注：{existingBatch.note}</p>
                                )}
                                <p className="text-xs text-slate-400 mt-2">Confirmed by {existingBatch.created_by}</p>
                            </div>
                        ) : (
                            <>
                                {/* Total Dividend Input */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">本月实际分红总额 <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">¥</span>
                                        <input
                                            type="number" min="0" step="0.01"
                                            value={totalDividend}
                                            onChange={e => handleTotalChange(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-4 text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                                        />
                                    </div>
                                </div>

                                {/* Shareholder Rows */}
                                <div className="mb-4">
                                    <div className="flex items-center mb-2">
                                        <label className="text-sm font-medium text-slate-700 flex-1">股东分配明细</label>
                                        <Edit3 className="w-4 h-4 text-slate-400" />
                                        <span className="text-xs text-slate-400 ml-1">可直接修改</span>
                                    </div>
                                    <div className="space-y-4">
                                        {rows.map((row, idx) => (
                                            <div key={row.name} className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100/50">
                                                <div className="grid grid-cols-[1fr_80px_130px] gap-3 items-center mb-2.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm">
                                                            {row.name[0]}
                                                        </div>
                                                        <span className="font-semibold text-slate-800 text-sm">{row.name}</span>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="number" min="0" max="100" step="1"
                                                            value={(row.ratio * 100).toFixed(0)}
                                                            onChange={e => handleRatioChange(idx, e.target.value)}
                                                            className="w-full rounded-lg border border-slate-200 py-1.5 pl-2 pr-6 text-sm text-slate-700 focus:ring-2 focus:ring-amber-500 outline-none text-center font-mono"
                                                        />
                                                        <span className="absolute inset-y-0 right-2 flex items-center text-slate-400 text-xs">%</span>
                                                    </div>
                                                    <div className="relative">
                                                        <span className="absolute inset-y-0 left-2 flex items-center text-slate-400 text-xs">¥</span>
                                                        <input
                                                            type="number" min="0" step="0.01"
                                                            value={row.amount}
                                                            onChange={e => handleAmountChange(idx, e.target.value)}
                                                            className="w-full rounded-lg border border-slate-200 py-1.5 pl-5 pr-2 text-sm text-slate-700 focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                                                        />
                                                    </div>
                                                </div>
                                                {Math.abs(row.amount - (parseFloat(totalDividend) || 0) * row.ratio) > 0.01 && (
                                                    <input
                                                        type="text"
                                                        value={row.note}
                                                        onChange={e => handleIndividualNoteChange(idx, e.target.value)}
                                                        placeholder={`金额偏离默认计算，请备注原因...`}
                                                        className="w-full bg-white rounded-lg border border-blue-200 py-1.5 px-3 text-xs text-blue-600 focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-blue-200 mt-2 animate-in fade-in slide-in-from-top-1 duration-200"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Ratio/amount validation hints */}
                                    <div className="flex items-center justify-between mt-2 px-1">
                                        <span className={`text-xs ${Math.abs(ratioSum - 1) > 0.001 ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>
                                            比例合计：{(ratioSum * 100).toFixed(0)}%
                                            {Math.abs(ratioSum - 1) > 0.001 && ' ⚠ 应为100%'}
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono">金额合计：{formatCurrency(amountSum)}</span>
                                    </div>
                                </div>

                                {/* Note */}
                                <div className="mb-5">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">备注（选填）</label>
                                    <input
                                        type="text"
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        placeholder="如：银行转账、微信转账..."
                                        className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                                    />
                                </div>

                                {submitError && (
                                    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" /> {submitError}
                                    </div>
                                )}

                                <button
                                    onClick={() => setConfirmOpen(true)}
                                    disabled={!summary || parseFloat(totalDividend) <= 0 || Math.abs(ratioSum - 1) > 0.001}
                                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all shadow-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                                >
                                    确认当月分红
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Right Panel: 历史与累计 ── */}
                <div className="xl:col-span-2 space-y-4">
                    {/* Cumulative Stats */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
                        {/* Decorative background element */}
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors duration-500" />
                        
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Users className="w-4 h-4" />
                                    <span className="text-xs font-semibold uppercase tracking-wider">分红统计</span>
                                </div>
                                <select 
                                    value={statsYear}
                                    onChange={(e) => setStatsYear(e.target.value)}
                                    className="text-xs font-bold text-slate-500 bg-slate-50 border-none rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-200 cursor-pointer"
                                >
                                    <option value="all">所有年份</option>
                                    {Array.from(new Set(allBatches.map(b => b.dividend_month.slice(0, 4)))).sort().reverse().map(y => (
                                        <option key={y} value={y}>{y}年度</option>
                                    ))}
                                    {/* Ensure current year is always an option even if no records yet */}
                                    {!allBatches.some(b => b.dividend_month.startsWith(new Date().getFullYear().toString())) && (
                                        <option value={new Date().getFullYear().toString()}>{new Date().getFullYear()}年度</option>
                                    )}
                                </select>
                            </div>
                            <div className="text-3xl font-bold font-mono tracking-tight text-slate-900 mb-6">
                                {formatCurrency(computedTotals.global)}
                            </div>
                            
                            <div className="space-y-3">
                                {SHAREHOLDERS.map(s => (
                                    <div key={s.name} className="flex items-center justify-between bg-blue-50/50 hover:bg-blue-50 rounded-xl px-4 py-3 transition-colors duration-300 border border-blue-100/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-blue-600 font-bold text-xs shadow-sm ring-1 ring-blue-100">
                                                {s.name[0]}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-800">{s.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold font-mono text-blue-700">{formatCurrency(computedTotals.perPerson[s.name] || 0)}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">累计分红</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* History List */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                            <History className="w-4 h-4 text-slate-400" />
                            <h3 className="text-sm font-semibold text-slate-800">历史分红记录</h3>
                        </div>
                        {historyLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
                        ) : allBatches.length === 0 ? (
                            <div className="py-10 text-center text-slate-400 text-sm">暂无历史分红记录</div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                                {allBatches.map(batch => {
                                    const monthStr = batch.dividend_month.slice(0, 7);
                                    const isSelected = selectedBatch?.id === batch.id;
                                    return (
                                        <div key={batch.id}>
                                            <button
                                                onClick={() => {
                                                    setSelectedBatch(isSelected ? null : batch);
                                                    setSelectedBatchDetails([]);
                                                    if (!isSelected) {
                                                        fetch(`/api/accounting/dividend?month=${monthStr}`)
                                                            .then(r => r.json())
                                                            .then(j => setSelectedBatchDetails(j.details || []));
                                                    }
                                                }}
                                                className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-slate-50 ${isSelected ? 'bg-amber-50' : ''}`}
                                            >
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-800">{monthStr} 分红</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">{batch.created_by}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold font-mono text-amber-700 text-sm">{formatCurrency(batch.total_dividend_amount)}</span>
                                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                                                </div>
                                            </button>
                                            {isSelected && (
                                                <div className="px-5 pb-4 bg-amber-50/50">
                                                    <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                                                        <div className="bg-white rounded-lg p-2 text-center">
                                                            <div className="text-slate-500">收款</div>
                                                            <div className="font-bold font-mono text-emerald-600">{formatCurrency(batch.based_on_revenue)}</div>
                                                        </div>
                                                        <div className="bg-white rounded-lg p-2 text-center">
                                                            <div className="text-slate-500">成本</div>
                                                            <div className="font-bold font-mono text-rose-600">{formatCurrency(batch.based_on_cost)}</div>
                                                        </div>
                                                        <div className="bg-white rounded-lg p-2 text-center">
                                                            <div className="text-slate-500">利润</div>
                                                            <div className="font-bold font-mono text-amber-600">{formatCurrency(batch.based_on_profit)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {selectedBatchDetails.map(d => (
                                                            <div key={d.shareholder_name}>
                                                                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                                                                    <span className="text-sm font-medium text-slate-700">{d.shareholder_name}</span>
                                                                    <span className="text-xs text-slate-400">{(d.ratio * 100).toFixed(0)}%</span>
                                                                    <span className="text-sm font-bold font-mono text-amber-700">{formatCurrency(d.dividend_amount)}</span>
                                                                </div>
                                                                {d.note && (
                                                                    <div className="mx-3 mt-1 text-[11px] text-blue-600/70 bg-blue-50/30 px-2 py-1 rounded border border-blue-100/30 flex items-start gap-1">
                                                                        <span className="font-semibold flex-shrink-0">备注:</span>
                                                                        <span>{d.note}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {batch.note && <p className="text-xs text-slate-500 mt-2">备注：{batch.note}</p>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog */}
            {confirmOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-900 text-lg flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-amber-500" /> 确认分红
                            </h3>
                            <p className="text-slate-500 text-sm mt-1">{selectedMonth} 月股东分红记录将被永久保存，无法撤销。</p>
                        </div>
                        <div className="px-6 py-4 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">实际分红总额</span>
                                <span className="font-bold font-mono text-amber-700 text-base">{formatCurrency(parseFloat(totalDividend) || 0)}</span>
                            </div>
                            <div className="space-y-2">
                                {rows.map(r => (
                                    <div key={r.name} className="flex justify-between text-sm bg-slate-50 px-3 py-2 rounded-lg">
                                        <span className="font-medium text-slate-700">{r.name} ({(r.ratio * 100).toFixed(0)}%)</span>
                                        <span className="font-bold font-mono text-slate-900">{formatCurrency(r.amount)}</span>
                                    </div>
                                ))}
                            </div>
                            {note && <p className="text-sm text-slate-500">备注：{note}</p>}
                        </div>
                        {submitError && (
                            <div className="mx-6 mb-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> {submitError}
                            </div>
                        )}
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => { setConfirmOpen(false); setSubmitError(null); }}
                                disabled={submitting}
                                className="flex-1 py-2.5 rounded-xl text-slate-700 border border-slate-200 hover:bg-slate-50 font-medium text-sm transition-all"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={submitting}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 font-semibold text-sm transition-all shadow-sm disabled:opacity-50"
                            >
                                {submitting ? (
                                    <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 提交中...</span>
                                ) : '确认提交'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
