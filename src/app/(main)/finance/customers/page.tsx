'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, FileText, Filter, X, ChevronLeft, ChevronRight, Wallet, BadgeAlert, TrendingUp, Calendar, AlertCircle, CheckCircle2, Banknote } from 'lucide-react';

// City prefixes to skip when picking avatar character
const CITY_PREFIXES = ['上海', '广州', '深圳', '北京', '杭州', '南京', '苏州', '成都', '武汉', '天津'];

function getAvatarChar(name: string): string {
    if (!name) return '?';
    for (const prefix of CITY_PREFIXES) {
        if (name.startsWith(prefix)) return name[prefix.length] ?? name[0];
    }
    return name[0];
}

type Receivable = {
    id: string;
    customer_id: string;
    billing_fee_month: number | null;
    pay_cycle_months: number | null;
    paid_months_ytd: number | null;
    receipt_note: string | null;
    discount_gap: number | null;
    amount_payable_period: number;
    standard_price: number | null;
    has_contract: boolean | null;
    payment_due_date: string;
    contract_end_date: string | null;
    remind_flag: boolean | null;
    remind_amount: number | null;
    status: string;
    note: string | null;
    created_at: string | null;
    current_receipt_date: string | null;
    current_receipt_amount: number | null;
    amount_paid_period: number | null;
    customers: {
        id: string;
        company_name: string;
        contact_person: string;
        contact_info: string;
        service_manager: string;
    };
};

type PaginatedResponse = {
    data: Receivable[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

const LIMIT = 10;

export default function FinanceCustomersPage() {
    const [receivables, setReceivables] = useState<Receivable[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [stats, setStats] = useState<{ totalPayable: number, totalPaid: number, arrearsCount: number, normalCount: number, totalReceivables: number } | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [selectedStatus, setSelectedStatus] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    const [selectedItem, setSelectedItem] = useState<Receivable | null>(null);

    // Edit functionality states
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Receivable>>({});
    const [saveLoading, setSaveLoading] = useState(false);

    const handleSaveEdit = async () => {
        if (!selectedItem || !editData) return;
        setSaveLoading(true);
        try {
            const res = await fetch(`/api/finance/customers/${selectedItem.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editData),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '保存失败');
            }

            // Refresh list and update selected item locally (or close modal)
            setIsEditing(false);
            setSelectedItem({ ...selectedItem, ...editData } as Receivable);
            fetchReceivables();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaveLoading(false);
        }
    };


    // Fetch stats
    useEffect(() => {
        setStatsLoading(true);
        fetch('/api/finance/customers/stats')
            .then(res => res.json())
            .then(data => {
                if (!data?.error) setStats(data);
            })
            .catch(console.error)
            .finally(() => setStatsLoading(false));
    }, []);

    // Debounced search
    const handleSearchChange = (value: string) => {
        setSearchInput(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearch(value);
            setPage(1);
        }, 350);
    };

    // Close filter dropdown
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setFilterOpen(false);
            }
        }
        if (filterOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [filterOpen]);

    // Fetch list
    const fetchReceivables = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(LIMIT),
                search,
                status: selectedStatus,
            });
            const res = await fetch(`/api/finance/customers?${params.toString()}`);
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const json: PaginatedResponse = await res.json();
            setReceivables(json.data);
            setTotal(json.total);
            setTotalPages(json.totalPages);
        } catch (err: any) {
            setError(err.message ?? '加载失败');
        } finally {
            setLoading(false);
        }
    }, [page, search, selectedStatus]);

    useEffect(() => {
        fetchReceivables();
    }, [fetchReceivables]);

    // Formatters
    const formatCurrency = (val: number | null | undefined, decimals: number = 2) => {
        if (val == null) return decimals === 0 ? '¥ 0' : '¥ 0.00';
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: 'CNY',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(val);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const isOverdue = (dateStr: string | null) => {
        if (!dateStr) return false;
        return new Date(dateStr).getTime() < new Date().getTime();
    };

    // Deterministic avatar colour
    const getAvatarStyle = (name: string) => {
        const colours = [
            'bg-blue-100 text-blue-700',
            'bg-violet-100 text-violet-700',
            'bg-teal-100 text-teal-700',
            'bg-indigo-100 text-indigo-700',
            'bg-cyan-100 text-cyan-700',
            'bg-orange-100 text-orange-700',
        ];
        const char = getAvatarChar(name);
        const idx = (char?.charCodeAt(0) ?? 0) % colours.length;
        return colours[idx];
    };

    const handleStatusFilter = (st: string) => {
        setSelectedStatus(st === selectedStatus ? '' : st);
        setPage(1);
        setFilterOpen(false);
    };

    const clearFilter = () => {
        setSelectedStatus('');
        setPage(1);
    };

    // Calculate Paid Status visually with aging logic
    const getPaidStatusInfo = (item: Receivable) => {
        const _status = String(item.status || 'unpaid').toLowerCase();
        const now = new Date();
        const dueDate = new Date(item.payment_due_date);

        // Calculate days remaining
        const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        if (_status === 'paid' || _status === 'pending') {
            // Logic: 
            // 1. If today is more than 45 days before the next due date, show as 'Waiting for Next Cycle'
            // 2. If it's within 45 days, it becomes 'Unpaid' to warn the collection team.
            if (diffDays <= 45) {
                return { label: '未付款', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: Wallet };
            }
            return { label: '待收下期', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 };
        }

        if (_status === 'partial') {
            return { label: '部分付款', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: TrendingUp };
        }

        // For Unpaid records
        if (diffDays < 0) {
            return { label: '已逾期', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: AlertCircle };
        }

        return { label: '未付款', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: Wallet };
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">财务客户列表</h1>
                    <p className="text-sm text-slate-500 mt-1">只展示核心财务数据，全方位掌握客户的资金与收费状态。</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    {/* Status Filter Button */}
                    <div className="relative" ref={filterRef}>
                        <button
                            onClick={() => setFilterOpen(!filterOpen)}
                            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-inset transition-all ${selectedStatus
                                ? 'bg-blue-50 text-blue-700 ring-blue-300 hover:bg-blue-100'
                                : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            <Filter className="w-4 h-4 mr-2" />
                            {selectedStatus ? `状态筛选` : '状态筛选'}
                            {selectedStatus && (
                                <span
                                    className="ml-2 text-blue-500 hover:text-blue-700 cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); clearFilter(); }}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </span>
                            )}
                        </button>

                        {/* Filter Dropdown */}
                        {filterOpen && (
                            <div className="absolute right-0 z-30 mt-2 w-40 bg-white rounded-xl shadow-lg ring-1 ring-slate-200 py-1 overflow-hidden">
                                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                                    按财务状态筛选
                                </div>
                                <button onClick={() => handleStatusFilter('')} className={`w-full text-left px-3 py-2 text-sm transition-colors ${!selectedStatus ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}>全部</button>
                                <button onClick={() => handleStatusFilter('已付清')} className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedStatus === '已付清' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}>已付清</button>
                                <button onClick={() => handleStatusFilter('未付款')} className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedStatus === '未付款' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}>未付款</button>
                                <button onClick={() => handleStatusFilter('已逾期')} className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedStatus === '已逾期' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}>已逾期(未付)</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Wallet className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">总应收金额</p>
                        <div className="mt-1">
                            {statsLoading ? <div className="h-7 w-24 bg-slate-100 animate-pulse rounded"></div> : <h3 className="text-xl font-bold text-slate-900">{formatCurrency(stats?.totalPayable, 0)}</h3>}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">已付金额汇总</p>
                        <div className="mt-1">
                            {statsLoading ? <div className="h-7 w-24 bg-slate-100 animate-pulse rounded"></div> : <h3 className="text-xl font-bold text-slate-900">{formatCurrency(stats?.totalPaid, 0)}</h3>}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                        <BadgeAlert className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">存在拖欠记录</p>
                        <div className="mt-1">
                            {statsLoading ? <div className="h-7 w-12 bg-slate-100 animate-pulse rounded"></div> : <h3 className="text-xl font-bold text-slate-900">{stats?.arrearsCount || 0} 家</h3>}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <Banknote className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">财务单数量</p>
                        <div className="mt-1">
                            {statsLoading ? <div className="h-7 w-12 bg-slate-100 animate-pulse rounded"></div> : <h3 className="text-xl font-bold text-slate-900">{stats?.totalReceivables || 0} 单</h3>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {/* Search Toolbar */}
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50">
                    <div className="relative max-w-sm w-full">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="搜索客户名称..."
                            className="block w-full rounded-xl border-0 py-2.5 pl-10 pr-9 text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all"
                            value={searchInput}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                        {searchInput && (
                            <button
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                                onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 whitespace-nowrap">
                        共 <span className="font-semibold text-slate-700">{total}</span> 条财务信息
                    </p>
                </div>

                {/* Data Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80">
                                <th scope="col" className="w-[28%] py-3.5 pl-6 pr-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">公司名称</th>
                                <th scope="col" className="w-[18%] px-4 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">应付日期</th>
                                <th scope="col" className="w-[18%] px-4 py-3.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-widest">每月费用</th>
                                <th scope="col" className="w-[18%] px-4 py-3.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-widest">应付总额</th>
                                <th scope="col" className="w-[18%] px-4 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">付款状态</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {/* Loading skeleton */}
                            {loading && Array.from({ length: 8 }).map((_, i) => (
                                <tr key={`skeleton-${i}`} className="animate-pulse">
                                    <td className="whitespace-nowrap py-4 pl-6 pr-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-slate-100" />
                                            <div className="h-4 bg-slate-100 rounded-full w-40" />
                                        </div>
                                    </td>
                                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded-full w-24" /></td>
                                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded-full w-20 ml-auto" /></td>
                                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded-full w-24 ml-auto" /></td>
                                    <td className="px-4 py-4"><div className="h-6 bg-slate-100 rounded-full w-20" /></td>
                                </tr>
                            ))}

                            {/* Error state */}
                            {!loading && error && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 text-red-500">
                                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                                                <X className="w-6 h-6" />
                                            </div>
                                            <p className="text-sm font-medium">加载失败：{error}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {/* Empty state */}
                            {!loading && !error && receivables.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                                                <Search className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium">{search || selectedStatus ? '没有找到符合条件的记录' : '暂无财务记录'}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {/* Data rows */}
                            {!loading && !error && receivables.map((item) => {
                                const st = getPaidStatusInfo(item);
                                const StatusIcon = st.icon;

                                return (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-blue-50/40 transition-colors duration-200 cursor-pointer group"
                                        onClick={() => { setSelectedItem(item); setIsEditing(false); setEditData(item); }}
                                    >
                                        <td className="py-4 pl-6 pr-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center font-bold text-sm ${getAvatarStyle(item.customers?.company_name || '')}`}>
                                                    {getAvatarChar(item.customers?.company_name || '')}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-slate-800 truncate text-sm group-hover:text-blue-700 transition-colors" title={item.customers?.company_name}>
                                                        {item.customers?.company_name || '未知公司'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className={`flex items-center gap-1.5 text-sm font-medium ${isOverdue(item.payment_due_date) && Number(item.amount_payable_period) > Number(item.amount_paid_period || 0) ? 'text-red-600' : 'text-slate-700'}`}>
                                                <Calendar className="w-4 h-4 opacity-70" />
                                                {formatDate(item.payment_due_date)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <span className="text-sm font-semibold text-slate-700 font-mono">
                                                {formatCurrency(item.billing_fee_month)}/月
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <span className="text-sm font-bold text-slate-900 font-mono">
                                                {formatCurrency(item.amount_payable_period)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-left">
                                            <span className={`inline-flex flex-shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${st.color} ${st.bg} ${st.border}`}>
                                                <StatusIcon className="w-3.5 h-3.5" />
                                                {st.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 flex items-center justify-between mt-auto">
                    <p className="text-xs text-slate-500">
                        第 <span className="font-semibold text-slate-700">{total === 0 ? 0 : (page - 1) * LIMIT + 1}</span> – <span className="font-semibold text-slate-700">{Math.min(page * LIMIT, total)}</span> 条 &nbsp;/&nbsp; 共 <span className="font-semibold text-slate-700">{total}</span> 条
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1 || loading}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-transparent hover:border-slate-200"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 7) {
                                pageNum = i + 1;
                            } else if (page <= 4) {
                                pageNum = i + 1;
                            } else if (page >= totalPages - 3) {
                                pageNum = totalPages - 6 + i;
                            } else {
                                pageNum = page - 3 + i;
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    className={`min-w-[2rem] h-8 px-2 text-xs rounded-lg transition-all ${pageNum === page
                                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                                        : 'text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm border border-transparent hover:border-slate-200'
                                        }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}

                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || loading}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-transparent hover:border-slate-200"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Slide-over: Detailed Financial View */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setSelectedItem(null)} />
                    <div className="relative bg-slate-50 w-full sm:w-[540px] h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">

                        {/* Header Area */}
                        <div className="px-6 py-6 bg-white border-b border-slate-200 flex justify-between items-start relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                            <div className="relative z-10 pr-8">
                                <h2 className="text-xl font-bold text-slate-900 leading-tight flex items-center gap-2">
                                    {selectedItem.customers?.company_name}
                                </h2>
                                <p className="text-sm text-slate-500 mt-1 flex items-center gap-4">
                                    <span>联系人: {selectedItem.customers?.contact_person || '-'}</span>
                                    <span>系统状态: <span className="font-semibold text-slate-700">{selectedItem.status}</span></span>
                                </p>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="relative z-10 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scroll Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 styled-scrollbar">

                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                                    <p className="text-xs font-medium text-slate-500 mb-1">应付总额</p>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            className="w-full mt-1 p-1 border border-slate-200 rounded text-xl font-bold text-slate-900"
                                            value={editData.amount_payable_period || ''}
                                            onChange={(e) => setEditData({ ...editData, amount_payable_period: Number(e.target.value) })}
                                        />
                                    ) : (
                                        <p className="text-xl font-bold text-slate-900">{formatCurrency(selectedItem.amount_payable_period)}</p>
                                    )}
                                </div>
                                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                                    <p className="text-xs font-medium text-slate-500 mb-1">已付款金额</p>
                                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(selectedItem.amount_paid_period)}</p>
                                </div>
                            </div>

                            {/* Details List */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-200 flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-slate-800">业务 & 收费详情</h3>
                                    {!isEditing ? (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-medium transition"
                                        >
                                            编辑
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="px-2 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded text-xs font-medium transition"
                                            >
                                                取消
                                            </button>
                                            <button
                                                onClick={handleSaveEdit}
                                                disabled={saveLoading}
                                                className="px-2 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded text-xs font-medium transition disabled:opacity-50"
                                            >
                                                {saveLoading ? '保存中...' : '保存'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="p-0">
                                    <dl className="divide-y divide-slate-100">
                                        <div className="px-4 py-3 grid grid-cols-3 gap-4 hover:bg-slate-50/50 transition-colors">
                                            <dt className="text-sm font-medium text-slate-500">每月服务费</dt>
                                            <dd className="text-sm font-medium text-slate-900 col-span-2">
                                                {isEditing ? (
                                                    <input type="number" className="w-full border rounded px-2 py-1 text-sm" value={editData.billing_fee_month || ''} onChange={e => setEditData({ ...editData, billing_fee_month: Number(e.target.value) })} />
                                                ) : formatCurrency(selectedItem.billing_fee_month)}
                                            </dd>
                                        </div>
                                        <div className="px-4 py-3 grid grid-cols-3 gap-4 hover:bg-slate-50/50 transition-colors">
                                            <dt className="text-sm font-medium text-slate-500">收费周期(月)</dt>
                                            <dd className="text-sm text-slate-900 col-span-2">
                                                {isEditing ? (
                                                    <input type="number" className="w-full border rounded px-2 py-1 text-sm" value={editData.pay_cycle_months || ''} onChange={e => setEditData({ ...editData, pay_cycle_months: Number(e.target.value) })} />
                                                ) : (selectedItem.pay_cycle_months || '-')}
                                            </dd>
                                        </div>
                                        <div className="px-4 py-3 grid grid-cols-3 gap-4 hover:bg-slate-50/50 transition-colors">
                                            <dt className="text-sm font-medium text-slate-500">标准价格</dt>
                                            <dd className="text-sm text-slate-900 col-span-2">
                                                {isEditing ? (
                                                    <input type="number" className="w-full border rounded px-2 py-1 text-sm" value={editData.standard_price || ''} onChange={e => setEditData({ ...editData, standard_price: Number(e.target.value) })} />
                                                ) : formatCurrency(selectedItem.standard_price)}
                                            </dd>
                                        </div>
                                        <div className="px-4 py-3 grid grid-cols-3 gap-4 hover:bg-slate-50/50 transition-colors">
                                            <dt className="text-sm font-medium text-slate-500">折扣差额</dt>
                                            <dd className="text-sm text-slate-900 col-span-2">
                                                {isEditing ? (
                                                    <input type="number" className="w-full border rounded px-2 py-1 text-sm" value={editData.discount_gap || ''} onChange={e => setEditData({ ...editData, discount_gap: Number(e.target.value) })} />
                                                ) : formatCurrency(selectedItem.discount_gap)}
                                            </dd>
                                        </div>
                                        <div className="px-4 py-3 grid grid-cols-3 gap-4 hover:bg-slate-50/50 transition-colors">
                                            <dt className="text-sm font-medium text-slate-500">是否有合同</dt>
                                            <dd className="text-sm text-slate-900 col-span-2 flex items-center">
                                                {isEditing ? (
                                                    <input type="checkbox" checked={editData.has_contract || false} onChange={e => setEditData({ ...editData, has_contract: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                                                ) : (selectedItem.has_contract ? '是' : '否')}
                                            </dd>
                                        </div>
                                        <div className="px-4 py-3 grid grid-cols-3 gap-4 hover:bg-slate-50/50 transition-colors">
                                            <dt className="text-sm font-medium text-slate-500">应付日期 (到期日)</dt>
                                            <dd className="text-sm text-slate-900 col-span-2">
                                                {isEditing ? (
                                                    <input type="date" className="w-full border rounded px-2 py-1 text-sm" value={editData.payment_due_date ? editData.payment_due_date.split('T')[0] : ''} onChange={e => setEditData({ ...editData, payment_due_date: e.target.value })} />
                                                ) : formatDate(selectedItem.payment_due_date)}
                                            </dd>
                                        </div>
                                        <div className="px-4 py-3 grid grid-cols-3 gap-4 hover:bg-slate-50/50 transition-colors">
                                            <dt className="text-sm font-medium text-slate-500">合同到期日</dt>
                                            <dd className="text-sm text-slate-900 col-span-2">
                                                {isEditing ? (
                                                    <input type="date" className="w-full border rounded px-2 py-1 text-sm" value={editData.contract_end_date ? editData.contract_end_date.split('T')[0] : ''} onChange={e => setEditData({ ...editData, contract_end_date: e.target.value })} />
                                                ) : formatDate(selectedItem.contract_end_date)}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>

                            {/* Additional Information */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-200 flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-slate-800">最新收款 & 备注</h3>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-medium text-slate-500">最近收款日期</p>
                                            <p className="text-sm font-medium text-slate-900 mt-1">{formatDate(selectedItem.current_receipt_date)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-slate-500">最近收款金额</p>
                                            <p className="text-sm font-medium text-emerald-600 mt-1">{formatCurrency(selectedItem.current_receipt_amount)}</p>
                                        </div>
                                    </div>
                                    {selectedItem.receipt_note && (
                                        <div>
                                            <p className="text-xs font-medium text-slate-500">收款单号/备注</p>
                                            <p className="text-sm text-slate-700 bg-slate-50 p-2.5 rounded-lg mt-1 border border-slate-100">{selectedItem.receipt_note}</p>
                                        </div>
                                    )}

                                    <div>
                                        <p className="text-xs font-medium text-slate-500">特殊说明</p>
                                        {isEditing ? (
                                            <textarea className="w-full border rounded px-2 py-1 text-sm mt-1 bg-amber-50/50 border-amber-100/50 min-h-[60px]" value={editData.note || ''} onChange={e => setEditData({ ...editData, note: e.target.value })} />
                                        ) : (
                                            selectedItem.note && <p className="text-sm text-slate-700 bg-amber-50/50 p-2.5 rounded-lg mt-1 border border-amber-100/50">{selectedItem.note}</p>
                                        )}
                                    </div>

                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
