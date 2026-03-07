'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    PhoneCall, CheckCircle2, Calendar, ChevronLeft, ChevronRight,
    AlertTriangle, Clock, Zap, RefreshCw, X, ChevronDown, User,
    BadgeAlert, Wallet, TrendingDown, StickyNote
} from 'lucide-react';
import { MaskedContact } from '@/components/ui/MaskedContact';

// ────────────────────────────────────────────────────────────── types
type CollectionTask = {
    id: string;
    customer_id: string;
    receivable_id: string | null;
    priority: string;
    status: string;
    target_amount: number | null;
    due_date: string;
    next_followup_at: string | null;
    owner: string | null;
    last_contact_at: string | null;
    note: string | null;
    uncollected_amount: number;
    overdue_days: number;
    days_until_due: number | null;
    is_overdue: boolean;
    receivable_due_date: string;
    customers: {
        id: string;
        company_name: string;
        contact_person: string;
        contact_info: string;
        service_manager: string;
    } | null;
    company_receivables: {
        payment_due_date: string;
        amount_payable_period: number;
        amount_paid_period: number | null;
        negotiated_payable_amount: number | null;
        amount_adjust_reason: string | null;
        billing_fee_month: number | null;
        receipt_note: string | null;
    } | null;
};

type Stats = {
    overdue_count: number;
    due_this_month_count: number;
    total_uncollected: number;
};

type Tab = 'due_this_month' | 'overdue';

const LIMIT = 15;

// ────────────────────────────────────────────────────────────── helpers
const CITY_PREFIXES = ['上海', '广州', '深圳', '北京', '杭州', '南京', '苏州', '成都', '武汉', '天津'];
function getAvatarChar(name: string) {
    if (!name) return '?';
    for (const prefix of CITY_PREFIXES) {
        if (name.startsWith(prefix)) return name[prefix.length] ?? name[0];
    }
    return name[0];
}

function formatCurrency(val: number | null | undefined, decimals = 0) {
    if (val == null) return '¥0';
    return new Intl.NumberFormat('zh-CN', {
        style: 'currency', currency: 'CNY',
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(val);
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    P0: { label: 'P0', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    P1: { label: 'P1', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
    P2: { label: 'P2', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
};

function getAvatarColor(name: string) {
    const colors = ['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-teal-100 text-teal-700', 'bg-indigo-100 text-indigo-700', 'bg-cyan-100 text-cyan-700', 'bg-orange-100 text-orange-700'];
    const ch = getAvatarChar(name);
    return colors[(ch?.charCodeAt(0) ?? 0) % colors.length];
}

// ────────────────────────────────────────────────────────────── main component
export default function CollectionTasksPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('due_this_month');
    const [tasks, setTasks] = useState<CollectionTask[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generateMsg, setGenerateMsg] = useState<string | null>(null);

    const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Detail panel state
    const [noteInput, setNoteInput] = useState('');
    const [followupInput, setFollowupInput] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [showFollowupPicker, setShowFollowupPicker] = useState<string | null>(null); // task id

    // Negotiation state
    const [negotiatedAmount, setNegotiatedAmount] = useState<string>('');
    const [adjustReason, setAdjustReason] = useState<string>('');
    const [savingNegotiation, setSavingNegotiation] = useState(false);

    // ── Stats
    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const res = await fetch('/api/finance/collection-tasks/stats');
            if (res.ok) setStats(await res.json());
        } catch { /* silent */ }
        finally { setStatsLoading(false); }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    // ── Task list
    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ tab: activeTab, page: String(page), limit: String(LIMIT) });
            const res = await fetch(`/api/finance/collection-tasks?${params}`);
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const json = await res.json();
            setTasks(json.data ?? []);
            setTotal(json.total ?? 0);
            setTotalPages(json.totalPages ?? 0);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [activeTab, page]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    // Switch tabs
    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        setPage(1);
    };

    // ── Quick actions
    const markContacted = async (task: CollectionTask) => {
        setUpdatingId(task.id);
        const todayStr = new Date().toISOString().split('T')[0];
        await fetch(`/api/finance/collection-tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ last_contact_at: todayStr }),
        });
        setUpdatingId(null);
        fetchTasks();
        fetchStats();
    };

    const markComplete = async (task: CollectionTask) => {
        if (!confirm(`确认将「${task.customers?.company_name}」任务标为已完成？`)) return;
        setUpdatingId(task.id);
        await fetch(`/api/finance/collection-tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' }),
        });
        setUpdatingId(null);
        if (selectedTask?.id === task.id) setSelectedTask(null);
        fetchTasks();
        fetchStats();
    };

    const setFollowup = async (taskId: string, date: string) => {
        setUpdatingId(taskId);
        await fetch(`/api/finance/collection-tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ next_followup_at: date }),
        });
        setUpdatingId(null);
        setShowFollowupPicker(null);
        fetchTasks();
    };

    const saveNote = async () => {
        if (!selectedTask) return;
        setSavingNote(true);
        await fetch(`/api/finance/collection-tasks/${selectedTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: noteInput }),
        });
        setSavingNote(false);
        fetchTasks();
        setSelectedTask(prev => prev ? { ...prev, note: noteInput } : null);
    };

    const handleNegotiate = async () => {
        if (!selectedTask || !negotiatedAmount || !adjustReason) return;
        setSavingNegotiation(true);
        try {
            const res = await fetch(`/api/finance/collection-tasks/${selectedTask.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    negotiated_payable_amount: parseFloat(negotiatedAmount),
                    amount_adjust_reason: adjustReason
                }),
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || '调整失败');
            }
            fetchTasks();
            fetchStats();
            // Update local selected task to reflect changes immediately
            setSelectedTask(prev => {
                if (!prev) return null;
                const newPayable = parseFloat(negotiatedAmount);
                const paid = prev.company_receivables?.amount_paid_period || 0;
                return {
                    ...prev,
                    uncollected_amount: Math.max(0, newPayable - paid),
                    company_receivables: prev.company_receivables ? {
                        ...prev.company_receivables,
                        negotiated_payable_amount: newPayable,
                        amount_adjust_reason: adjustReason
                    } : null
                };
            });
            alert('优惠提交成功');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSavingNegotiation(false);
        }
    };

    // ── Generate
    const handleGenerate = async () => {
        setGenerating(true);
        setGenerateMsg(null);
        try {
            const res = await fetch('/api/finance/collection-tasks/generate', { method: 'POST' });
            const json = await res.json();
            setGenerateMsg(json.message ?? (json.error ? `错误: ${json.error}` : '完成'));
            fetchTasks();
            fetchStats();
        } catch (err: any) {
            setGenerateMsg(`请求失败: ${err.message}`);
        } finally {
            setGenerating(false);
            setTimeout(() => setGenerateMsg(null), 4000);
        }
    };

    // Open detail panel
    const openDetail = (task: CollectionTask) => {
        setSelectedTask(task);
        setNoteInput(task.note ?? '');
        setFollowupInput(task.next_followup_at ?? '');
        setNegotiatedAmount(task.company_receivables?.negotiated_payable_amount?.toString() ?? task.company_receivables?.amount_payable_period?.toString() ?? '');
        setAdjustReason(task.company_receivables?.amount_adjust_reason ?? '');
    };

    // ────────────────────────────────────────────── render
    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">催款任务</h1>
                    <p className="text-sm text-slate-500 mt-1">集中跟进逾期与本月应付的未结清账款，高效完成催收。</p>
                </div>
                <div className="flex items-center gap-3">
                    {generateMsg && (
                        <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full animate-in fade-in">
                            {generateMsg}
                        </span>
                    )}
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-all disabled:opacity-60"
                    >
                        <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                        {generating ? '生成中...' : '生成任务'}
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">逾期未收</p>
                        <div className="mt-1">
                            {statsLoading
                                ? <div className="h-7 w-16 bg-slate-100 animate-pulse rounded" />
                                : <h3 className="text-xl font-bold text-slate-900">{stats?.overdue_count ?? 0} 条</h3>}
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">本月应付</p>
                        <div className="mt-1">
                            {statsLoading
                                ? <div className="h-7 w-16 bg-slate-100 animate-pulse rounded" />
                                : <h3 className="text-xl font-bold text-slate-900">{stats?.due_this_month_count ?? 0} 条</h3>}
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <TrendingDown className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">待收总额</p>
                        <div className="mt-1">
                            {statsLoading
                                ? <div className="h-7 w-24 bg-slate-100 animate-pulse rounded" />
                                : <h3 className="text-xl font-bold text-slate-900">{formatCurrency(stats?.total_uncollected)}</h3>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs + List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Tab Bar */}
                <div className="flex items-center border-b border-slate-200 px-4 pt-3 gap-1">
                    <button
                        onClick={() => handleTabChange('due_this_month')}
                        className={`relative px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'due_this_month'
                            ? 'text-blue-700 bg-blue-50/60'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            当月应付
                            {!statsLoading && stats && stats.due_this_month_count > 0 && (
                                <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                    {stats.due_this_month_count}
                                </span>
                            )}
                        </span>
                        {activeTab === 'due_this_month' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
                        )}
                    </button>
                    <button
                        onClick={() => handleTabChange('overdue')}
                        className={`relative px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'overdue'
                            ? 'text-red-700 bg-red-50/60'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            逾期
                            {!statsLoading && stats && stats.overdue_count > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                    {stats.overdue_count}
                                </span>
                            )}
                        </span>
                        {activeTab === 'overdue' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 rounded-t" />
                        )}
                    </button>
                    <div className="ml-auto pb-2 pr-1 text-xs text-slate-400">
                        共 {total} 条
                    </div>
                </div>

                {/* Task List */}
                <div className="divide-y divide-slate-100">
                    {/* Loading */}
                    {loading && Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="p-5 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-slate-100 flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-slate-100 rounded-full w-40" />
                                    <div className="h-3 bg-slate-100 rounded-full w-56" />
                                </div>
                                <div className="h-8 w-20 bg-slate-100 rounded-lg" />
                                <div className="h-8 w-20 bg-slate-100 rounded-lg" />
                            </div>
                        </div>
                    ))}

                    {/* Empty */}
                    {!loading && tasks.length === 0 && (
                        <div className="py-20 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                                    <CheckCircle2 className="w-7 h-7 text-slate-400" />
                                </div>
                                <p className="text-sm text-slate-500 font-medium">
                                    {activeTab === 'due_this_month' ? '本月暂无待催款项 🎉' : '暂无逾期账款 🎉'}
                                </p>
                                <p className="text-xs text-slate-400">点击"生成任务"创建催款记录</p>
                            </div>
                        </div>
                    )}

                    {/* Task cards */}
                    {!loading && tasks.map((task) => {
                        const pCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.P2;
                        const companyName = task.customers?.company_name ?? '未知公司';
                        const isUpdating = updatingId === task.id;

                        return (
                            <div
                                key={task.id}
                                className="p-5 hover:bg-slate-50/60 transition-colors group cursor-pointer"
                                onClick={() => openDetail(task)}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Avatar */}
                                    <div className={`h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center font-bold text-sm ${getAvatarColor(companyName)}`}>
                                        {getAvatarChar(companyName)}
                                    </div>

                                    {/* Main info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-slate-800 text-sm truncate group-hover:text-blue-700 transition-colors" title={companyName}>
                                                {companyName}
                                            </span>
                                            {/* Priority badge */}
                                            {(() => {
                                                let labelText = '别忘了收钱!';
                                                if (task.priority === 'P0') {
                                                    if (task.overdue_days > 30) labelText = '长时间拖欠';
                                                    else if (task.uncollected_amount >= 5000) labelText = '大金额!';
                                                } else if (task.priority === 'P1') {
                                                    if (task.is_overdue && task.overdue_days >= 1) labelText = '快去催!';
                                                    else if (task.days_until_due !== null && task.days_until_due <= 3) labelText = '快到期了!';
                                                    else if (task.uncollected_amount >= 1000) labelText = '记得催款!';
                                                }
                                                return (
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold ${pCfg.bg} ${pCfg.text}`}>
                                                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />
                                                        {labelText}
                                                    </span>
                                                );
                                            })()}
                                            {/* Overdue / Due tag */}
                                            {task.is_overdue ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    逾期 {task.overdue_days} 天
                                                </span>
                                            ) : task.days_until_due !== null && task.days_until_due >= 0 ? (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${task.days_until_due <= 3
                                                    ? 'bg-orange-50 text-orange-600 border-orange-100'
                                                    : 'bg-blue-50 text-blue-600 border-blue-100'
                                                    }`}>
                                                    <Clock className="w-3 h-3" />
                                                    {task.days_until_due === 0 ? '今天到期' : `${task.days_until_due} 天后到期`}
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="mt-1.5 flex items-center gap-4 flex-wrap text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                应付日 {formatDate(task.receivable_due_date)}
                                            </span>
                                            {task.owner && (
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {task.owner}
                                                </span>
                                            )}
                                            {task.next_followup_at && (
                                                <span className="flex items-center gap-1 text-indigo-500">
                                                    <Calendar className="w-3 h-3" />
                                                    下次跟进 {formatDate(task.next_followup_at)}
                                                </span>
                                            )}
                                            {task.last_contact_at && (
                                                <span className="flex items-center gap-1 text-emerald-600">
                                                    <PhoneCall className="w-3 h-3" />
                                                    上次联系 {formatDate(task.last_contact_at)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: uncollected amount + actions */}
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-slate-400">未收</p>
                                            <p className="text-base font-bold text-slate-900 font-mono">{formatCurrency(task.uncollected_amount)}</p>
                                        </div>

                                        {/* Quick action buttons */}
                                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                            {/* Mark contacted */}
                                            <button
                                                title="标记已联系"
                                                disabled={isUpdating}
                                                onClick={() => markContacted(task)}
                                                className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                                            >
                                                <PhoneCall className="w-4 h-4" />
                                            </button>

                                            {/* Set follow-up */}
                                            <div className="relative">
                                                <button
                                                    title="设置下次跟进"
                                                    disabled={isUpdating}
                                                    onClick={() => {
                                                        setShowFollowupPicker(showFollowupPicker === task.id ? null : task.id);
                                                        setFollowupInput(task.next_followup_at ?? '');
                                                    }}
                                                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40"
                                                >
                                                    <Calendar className="w-4 h-4" />
                                                </button>
                                                {showFollowupPicker === task.id && (
                                                    <div className="absolute right-0 top-10 z-20 bg-white rounded-xl shadow-lg border border-slate-200 p-3 w-52" onClick={e => e.stopPropagation()}>
                                                        <p className="text-xs font-semibold text-slate-600 mb-2">设置下次跟进日期</p>
                                                        <input
                                                            type="date"
                                                            value={followupInput}
                                                            onChange={e => setFollowupInput(e.target.value)}
                                                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                                        />
                                                        <div className="flex gap-2 mt-2">
                                                            <button
                                                                onClick={() => setFollowup(task.id, followupInput)}
                                                                disabled={!followupInput}
                                                                className="flex-1 text-xs bg-blue-600 text-white rounded-lg py-1.5 hover:bg-blue-700 disabled:opacity-40 transition-colors"
                                                            >确认</button>
                                                            <button
                                                                onClick={() => setShowFollowupPicker(null)}
                                                                className="flex-1 text-xs bg-slate-100 text-slate-600 rounded-lg py-1.5 hover:bg-slate-200 transition-colors"
                                                            >取消</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Go to payment entry */}
                                            <button
                                                title="去收款录入"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/finance/payment?customer_name=${encodeURIComponent(companyName)}&task_id=${task.id}`);
                                                }}
                                                className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                            >
                                                <Wallet className="w-4 h-4" />
                                            </button>

                                            {/* Mark complete */}
                                            <button
                                                title="标记完成"
                                                disabled={isUpdating}
                                                onClick={() => markComplete(task)}
                                                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            第 <span className="font-semibold text-slate-700">{total === 0 ? 0 : (page - 1) * LIMIT + 1}</span>–
                            <span className="font-semibold text-slate-700">{Math.min(page * LIMIT, total)}</span> 条&nbsp;/&nbsp;共 <span className="font-semibold text-slate-700">{total}</span> 条
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1 || loading}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-transparent hover:border-slate-200"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                let pn: number;
                                if (totalPages <= 7) pn = i + 1;
                                else if (page <= 4) pn = i + 1;
                                else if (page >= totalPages - 3) pn = totalPages - 6 + i;
                                else pn = page - 3 + i;
                                return (
                                    <button key={pn} onClick={() => setPage(pn)}
                                        className={`min-w-[2rem] h-8 px-2 text-xs rounded-lg transition-all ${pn === page ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm border border-transparent hover:border-slate-200'}`}>
                                        {pn}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages || loading}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-transparent hover:border-slate-200"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Detail slide-over */}
            {selectedTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setSelectedTask(null)} />
                    <div className="relative bg-slate-50 w-full sm:w-[520px] h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
                        {/* Panel header */}
                        <div className="px-6 py-5 bg-white border-b border-slate-200 flex justify-between items-start relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-28 h-28 bg-blue-50 rounded-full blur-3xl -mr-8 -mt-8 pointer-events-none" />
                            <div className="relative z-10 pr-8">
                                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                                    {selectedTask.customers?.company_name ?? '未知公司'}
                                </h2>
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                    {(() => {
                                        let labelText = '别忘了收钱!';
                                        if (selectedTask.priority === 'P0') {
                                            if (selectedTask.overdue_days > 30) labelText = '长时间拖欠';
                                            else if (selectedTask.uncollected_amount >= 5000) labelText = '大金额!';
                                        } else if (selectedTask.priority === 'P1') {
                                            if (selectedTask.is_overdue && selectedTask.overdue_days >= 1) labelText = '快去催!';
                                            else if (selectedTask.days_until_due !== null && selectedTask.days_until_due <= 3) labelText = '快到期了!';
                                            else if (selectedTask.uncollected_amount >= 1000) labelText = '记得催款!';
                                        }
                                        return (
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold ${(PRIORITY_CONFIG[selectedTask.priority] ?? PRIORITY_CONFIG.P2).bg} ${(PRIORITY_CONFIG[selectedTask.priority] ?? PRIORITY_CONFIG.P2).text}`}>
                                                {labelText}
                                            </span>
                                        );
                                    })()}
                                    {selectedTask.is_overdue ? (
                                        <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                                            逾期 {selectedTask.overdue_days} 天
                                        </span>
                                    ) : (
                                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                            本月应付
                                        </span>
                                    )}
                                    <span className="text-xs text-slate-500">{selectedTask.status}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedTask(null)} className="relative z-10 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Scroll body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {/* Amount cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                                    <p className="text-xs font-medium text-slate-500 mb-1">应付总额</p>
                                    <p className="text-lg font-bold text-slate-900">{formatCurrency(selectedTask.company_receivables?.amount_payable_period)}</p>
                                </div>
                                <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm bg-red-50/30">
                                    <p className="text-xs font-medium text-slate-500 mb-1">待收金额</p>
                                    <p className="text-lg font-bold text-red-700">{formatCurrency(selectedTask.uncollected_amount)}</p>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-200">
                                    <h3 className="text-sm font-semibold text-slate-800">任务详情</h3>
                                </div>
                                <dl className="divide-y divide-slate-100">
                                    {[
                                        { label: '应付日期', value: formatDate(selectedTask.receivable_due_date) },
                                        { label: '下次跟进', value: formatDate(selectedTask.next_followup_at) },
                                        { label: '上次联系', value: formatDate(selectedTask.last_contact_at) },
                                        { label: '负责人', value: selectedTask.owner ?? '-' },
                                        { label: '联系人', value: selectedTask.customers?.contact_person ?? '-' },
                                        { label: '联系方式', value: selectedTask.customers?.contact_info ? <MaskedContact contact={selectedTask.customers.contact_info} /> : '-' },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="px-4 py-2.5 grid grid-cols-3 gap-4 hover:bg-slate-50/50 transition-colors">
                                            <dt className="text-sm font-medium text-slate-500">{label}</dt>
                                            <dd className="text-sm text-slate-900 col-span-2">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>

                            {/* Follow-up date picker */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                                <p className="text-sm font-semibold text-slate-800">设置下次跟进日期</p>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={followupInput}
                                        onChange={e => setFollowupInput(e.target.value)}
                                        className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <button
                                        onClick={() => setFollowup(selectedTask.id, followupInput)}
                                        disabled={!followupInput}
                                        className="px-4 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                                    >保存</button>
                                </div>
                            </div>

                            {/* Note */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                                <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                                    <StickyNote className="w-4 h-4 text-amber-500" /> 备注
                                </p>
                                <textarea
                                    rows={3}
                                    value={noteInput}
                                    onChange={e => setNoteInput(e.target.value)}
                                    placeholder="记录催款情况、客户回应、付款承诺..."
                                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                />
                                <button
                                    onClick={saveNote}
                                    disabled={savingNote || noteInput === (selectedTask.note ?? '')}
                                    className="w-full text-sm bg-slate-800 text-white rounded-lg py-2 hover:bg-slate-900 disabled:opacity-40 transition-colors"
                                >
                                    {savingNote ? '保存中...' : '保存备注'}
                                </button>
                            </div>

                            {/* Price Negotiation Section */}
                            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                                <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                                    <TrendingDown className="w-4 h-4 text-emerald-500" /> 协商优惠 (Negotiate Discount)
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">协商后的应付金额 (Negotiated Amount)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-slate-400 text-sm">¥</span>
                                            <input
                                                type="number"
                                                value={negotiatedAmount}
                                                onChange={e => setNegotiatedAmount(e.target.value)}
                                                placeholder="输入协商后的最终金额"
                                                className="w-full text-sm border border-slate-200 rounded-lg pl-7 pr-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">价格优惠理由 (Reason - Required)</label>
                                        <input
                                            type="text"
                                            value={adjustReason}
                                            onChange={e => setAdjustReason(e.target.value)}
                                            placeholder="例如：大客户优惠、金额抹零、协商减免..."
                                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                    <button
                                        onClick={handleNegotiate}
                                        disabled={savingNegotiation || !negotiatedAmount || !adjustReason || (
                                            parseFloat(negotiatedAmount) === selectedTask.company_receivables?.negotiated_payable_amount &&
                                            adjustReason === selectedTask.company_receivables?.amount_adjust_reason
                                        )}
                                        className="w-full text-sm bg-emerald-600 text-white rounded-lg py-2 shadow-sm hover:bg-emerald-700 disabled:opacity-40 transition-colors font-medium"
                                    >
                                        {savingNegotiation ? '保存中...' : '提交优惠申请'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Panel footer actions */}
                        <div className="border-t border-slate-200 bg-white p-4 flex gap-3">
                            <button
                                onClick={() => markContacted(selectedTask)}
                                disabled={!!updatingId}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50"
                            >
                                <PhoneCall className="w-4 h-4" /> 标记已联系
                            </button>
                            <button
                                onClick={() => {
                                    router.push(`/finance/payment?customer_name=${encodeURIComponent(selectedTask.customers?.company_name || '')}&task_id=${selectedTask.id}`);
                                }}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                            >
                                <Wallet className="w-4 h-4" /> 去收款录入
                            </button>
                            <button
                                onClick={() => markComplete(selectedTask)}
                                disabled={!!updatingId}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-4 h-4" /> 标记完成
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


