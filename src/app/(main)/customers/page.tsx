'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, FileText, UserMinus, Filter, X, ChevronLeft, ChevronRight, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// City prefixes to skip when picking avatar character
const CITY_PREFIXES = ['上海', '广州', '深圳', '北京', '杭州', '南京', '苏州', '成都', '武汉', '天津'];

function getAvatarChar(name: string): string {
    if (!name) return '?';
    for (const prefix of CITY_PREFIXES) {
        if (name.startsWith(prefix)) return name[prefix.length] ?? name[0];
    }
    return name[0];
}

// Type definitions matching the Supabase schema
type Customer = {
    id: string;
    company_name: string;
    website_member: string;
    contact_person: string;
    contact_info: string;
    address: string;
    customer_status: string;
    source_info: string;
    service_manager: string;
    created_at: string;
    [key: string]: any;
};

type PaginatedResponse = {
    data: Customer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

const LIMIT = 10;

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [stats, setStats] = useState<{ totalCustomers: number, monthlyChange: number, thisMonthCount: number, lastMonthCount: number } | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        setStatsLoading(true);
        fetch('/api/customers/stats')
            .then(res => res.json())
            .then(data => {
                if (!data?.error) setStats(data);
            })
            .catch(console.error)
            .finally(() => setStatsLoading(false));
    }, []);

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [serviceManagers, setServiceManagers] = useState<string[]>([]);
    const [selectedManager, setSelectedManager] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    // Debounced search: update `search` state 350ms after user stops typing
    const handleSearchChange = (value: string) => {
        setSearchInput(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearch(value);
            setPage(1);
        }, 350);
    };

    // Close filter dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setFilterOpen(false);
            }
        }
        if (filterOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [filterOpen]);

    // Fetch distinct service_manager values for the filter dropdown
    useEffect(() => {
        fetch('/api/customers/service-managers')
            .then((r) => r.json())
            .then((res) => { if (res.data) setServiceManagers(res.data); })
            .catch(console.error);
    }, []);

    // Fetch customers whenever search, filter, or page changes
    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(LIMIT),
                search,
                service_manager: selectedManager,
            });
            const res = await fetch(`/api/customers?${params.toString()}`);
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const json: PaginatedResponse = await res.json();
            setCustomers(json.data);
            setTotal(json.total);
            setTotalPages(json.totalPages);
        } catch (err: any) {
            setError(err.message ?? '加载失败');
        } finally {
            setLoading(false);
        }
    }, [page, search, selectedManager]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    // Status helpers
    const getStatusStyle = (status: string) => {
        if (!status) return 'bg-slate-100 text-slate-500';
        const s = status.toLowerCase();
        if (s.includes('正常') || s.includes('normal')) return 'bg-emerald-100 text-emerald-700';
        if (s.includes('拖欠户') || s.includes('arrears')) return 'bg-amber-100 text-amber-700';
        return 'bg-slate-100 text-slate-500';
    };
    const getStatusDot = (status: string) => {
        if (!status) return 'bg-slate-400';
        const s = status.toLowerCase();
        if (s.includes('正常') || s.includes('normal')) return 'bg-emerald-500';
        if (s.includes('拖欠户') || s.includes('arrears')) return 'bg-amber-500';
        return 'bg-slate-400';
    };
    const getStatusText = (status: string) => {
        if (!status) return '-';
        const s = status.toLowerCase();
        if (s === 'normal') return '正常';
        if (s === 'arrears') return '拖欠户';
        return status;
    };

    // Deterministic colour for avatar based on first char code
    const getAvatarStyle = (name: string) => {
        const colours = [
            'bg-blue-100 text-blue-700',
            'bg-violet-100 text-violet-700',
            'bg-amber-100 text-amber-700',
            'bg-teal-100 text-teal-700',
            'bg-rose-100 text-rose-700',
            'bg-indigo-100 text-indigo-700',
            'bg-cyan-100 text-cyan-700',
            'bg-orange-100 text-orange-700',
        ];
        const char = getAvatarChar(name);
        const idx = (char?.charCodeAt(0) ?? 0) % colours.length;
        return colours[idx];
    };

    const handleManagerFilter = (manager: string) => {
        setSelectedManager(manager === selectedManager ? '' : manager);
        setPage(1);
        setFilterOpen(false);
    };

    const clearFilter = () => {
        setSelectedManager('');
        setPage(1);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">客户档案</h1>
                    <p className="text-sm text-slate-500 mt-1">管理客户基本信息、联系人及服务状态，全面掌握客户动态。</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    {/* Finance Filter Button */}
                    <div className="relative" ref={filterRef}>
                        <button
                            onClick={() => setFilterOpen(!filterOpen)}
                            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-inset transition-all ${selectedManager
                                ? 'bg-blue-50 text-blue-700 ring-blue-300 hover:bg-blue-100'
                                : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            <Filter className="w-4 h-4 mr-2" />
                            {selectedManager ? `财务: ${selectedManager}` : '财务筛选'}
                            {selectedManager && (
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
                            <div className="absolute z-30 mt-2 w-48 bg-white rounded-xl shadow-lg ring-1 ring-slate-200 py-1 overflow-hidden">
                                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                                    按财务筛选
                                </div>
                                <button
                                    onClick={() => handleManagerFilter('')}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${!selectedManager ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    全部
                                </button>
                                {serviceManagers.length === 0 && (
                                    <div className="px-3 py-2 text-sm text-slate-400">无可用选项</div>
                                )}
                                {serviceManagers.map((mgr) => (
                                    <button
                                        key={mgr}
                                        onClick={() => handleManagerFilter(mgr)}
                                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedManager === mgr ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        {mgr}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-all"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        新增客户
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">当前客户数量</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            {statsLoading ? (
                                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded"></div>
                            ) : (
                                <h3 className="text-2xl font-bold text-slate-900">{stats?.totalCustomers || 0}</h3>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">本月新增客户</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            {statsLoading ? (
                                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded"></div>
                            ) : (
                                <>
                                    <h3 className="text-2xl font-bold text-slate-900">{stats?.thisMonthCount || 0}</h3>
                                    <span className={`text-sm font-medium ml-2 flex items-center px-2 py-0.5 rounded-full ${(stats?.monthlyChange || 0) > 0 ? 'bg-emerald-50 text-emerald-700' :
                                            (stats?.monthlyChange || 0) < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                        {(stats?.monthlyChange || 0) > 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> :
                                            (stats?.monthlyChange || 0) < 0 ? <TrendingDown className="w-3.5 h-3.5 mr-1" /> : <Minus className="w-3.5 h-3.5 mr-1" />}
                                        较上月变化 {(stats?.monthlyChange || 0) > 0 ? '+' : ''}{(stats?.monthlyChange || 0)}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Search Toolbar */}
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50">
                    <div className="relative max-w-sm w-full">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="搜索公司名、联系人..."
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
                        共 <span className="font-semibold text-slate-700">{total}</span> 条记录
                    </p>
                </div>

                {/* Data Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80">
                                <th scope="col" className="w-[32%] py-3.5 pl-6 pr-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">公司名称</th>
                                <th scope="col" className="w-[23%] px-4 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">联系人</th>
                                <th scope="col" className="w-[15%] px-4 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">状态</th>
                                <th scope="col" className="w-[15%] px-4 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">财务</th>
                                <th scope="col" className="w-[15%] py-3.5 pl-4 pr-6 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-widest">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {/* Loading skeleton */}
                            {loading && Array.from({ length: 8 }).map((_, i) => (
                                <tr key={`skeleton-${i}`} className="animate-pulse">
                                    <td className="whitespace-nowrap py-5 pl-6 pr-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-slate-100" />
                                            <div className="space-y-2">
                                                <div className="h-3.5 bg-slate-100 rounded-full w-44" />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5"><div className="space-y-2"><div className="h-3.5 bg-slate-100 rounded-full w-20" /><div className="h-3 bg-slate-100 rounded-full w-32" /></div></td>
                                    <td className="px-4 py-5"><div className="h-6 bg-slate-100 rounded-full w-16" /></td>
                                    <td className="px-4 py-5"><div className="h-3.5 bg-slate-100 rounded-full w-12" /></td>
                                    <td className="py-5 pl-4 pr-6"><div className="h-8 bg-slate-100 rounded-lg w-20 mx-auto" /></td>
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
                            {!loading && !error && customers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                                                <Search className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium">{search || selectedManager ? '没有找到符合条件的客户' : '暂无客户数据'}</p>
                                            {(search || selectedManager) && (
                                                <button onClick={() => { setSearch(''); setSearchInput(''); clearFilter(); }} className="text-xs text-blue-600 hover:underline">清除筛选条件</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {/* Data rows */}
                            {!loading && !error && customers.map((customer) => (
                                <tr key={customer.id} className="hover:bg-blue-50/30 transition-colors duration-150">
                                    <td className="py-4 pl-6 pr-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center font-bold text-sm ${getAvatarStyle(customer.company_name)}`}>
                                                {getAvatarChar(customer.company_name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-slate-800 truncate text-sm" title={customer.company_name}>
                                                    {customer.company_name}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="text-sm font-medium text-slate-800 truncate" title={customer.contact_person || ''}>
                                            {customer.contact_person || '-'}
                                        </div>
                                        <div className="text-xs text-slate-400 truncate mt-0.5" title={customer.contact_info}>
                                            {customer.contact_info || ''}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-left">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(customer.customer_status)}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(customer.customer_status)}`} />
                                            {getStatusText(customer.customer_status)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        {customer.service_manager
                                            ? <span className="text-sm text-slate-700 font-medium truncate block" title={customer.service_manager}>{customer.service_manager}</span>
                                            : <span className="text-sm text-slate-300">—</span>
                                        }
                                    </td>
                                    <td className="py-4 pl-4 pr-6 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => setSelectedCustomer(customer)}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-all border border-transparent hover:border-blue-100"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                详情
                                            </button>
                                            <button
                                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-all border border-transparent hover:border-red-100"
                                            >
                                                <UserMinus className="w-3.5 h-3.5" />
                                                流失
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 flex items-center justify-between">
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

            {/* Modal: Add Customer */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h2 className="text-xl font-semibold text-slate-900">新增客户</h2>
                            <p className="text-sm text-slate-500 mt-1">请填写核心信息，其他资料可在详情页补充。</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">公司名称 <span className="text-red-500">*</span></label>
                                <input type="text" className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors" placeholder="如：科技创新网络有限公司" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">联系人 <span className="text-red-500">*</span></label>
                                <input type="text" className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors" placeholder="如：张经理" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">客户状态</label>
                                    <select className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white transition-colors">
                                        <option value="normal">正常</option>
                                        <option value="arrears">拖欠户</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">财务</label>
                                    <select className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white transition-colors">
                                        <option value="">请选择</option>
                                        {serviceManagers.map((m) => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-xl transition-colors">取消</button>
                            <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors">保存并创建</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Slide-over: Customer Details */}
            {selectedCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)} />
                    <div className="relative bg-white w-full sm:w-[480px] h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start">
                            <div className="pr-8">
                                <h2 className="text-xl font-bold text-slate-900 leading-tight">{selectedCustomer.company_name}</h2>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-3 ${getStatusStyle(selectedCustomer.customer_status)}`}>
                                    {getStatusText(selectedCustomer.customer_status)}
                                </span>
                            </div>
                            <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-6">
                                <div>
                                    <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">联系人</dt>
                                    <dd className="mt-1 text-sm text-slate-900">{selectedCustomer.contact_person || '-'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">财务</dt>
                                    <dd className="mt-1 text-sm text-slate-900">{selectedCustomer.service_manager || '-'}</dd>
                                </div>
                                <div className="col-span-2">
                                    <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">联系信息</dt>
                                    <dd className="mt-1 text-sm text-slate-900 break-words">{selectedCustomer.contact_info || '-'}</dd>
                                </div>
                                <div className="col-span-2">
                                    <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">公司地址</dt>
                                    <dd className="mt-1 text-sm text-slate-900">{selectedCustomer.address || '未填写'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">官网账号</dt>
                                    <dd className="mt-1 text-sm text-slate-900">{selectedCustomer.website_member || '-'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">客户来源</dt>
                                    <dd className="mt-1 text-sm text-slate-900">{selectedCustomer.source_info || '-'}</dd>
                                </div>
                                <div className="col-span-2">
                                    <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">创建时间</dt>
                                    <dd className="mt-1 text-sm text-slate-900">
                                        {selectedCustomer.created_at ? new Date(selectedCustomer.created_at).toLocaleString('zh-CN') : '-'}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
