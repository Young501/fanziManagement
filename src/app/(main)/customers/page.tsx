'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, FileText, UserMinus, Filter, X, ChevronLeft, ChevronRight, Users, TrendingUp, TrendingDown, Minus, Building2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { MaskedContact } from '@/components/ui/MaskedContact';

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

    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailData, setDetailData] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

    // Edit functionality states
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Customer>>({});
    const [saveLoading, setSaveLoading] = useState(false);

    const openCustomerDetails = useCallback((id: string) => {
        setSelectedCustomerId(id);
        setIsDetailModalOpen(true);
        setDetailLoading(true);
        setDetailError(null);
        setIsEditing(false); // Reset edit state when opening a new customer
        fetch(`/api/customers/${id}`)
            .then(res => res.json())
            .then(res => {
                if (res.error) throw new Error(res.error);
                setDetailData(res);
                setEditData(res.customer); // Pre-fill edit form
            })
            .catch(err => setDetailError(err.message))
            .finally(() => setDetailLoading(false));
    }, []);

    const handleSaveEdit = async () => {
        if (!selectedCustomerId || !editData) return;
        setSaveLoading(true);
        try {
            const res = await fetch(`/api/customers/${selectedCustomerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editData),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '保存失败');
            }

            // Refresh detail data and list
            setIsEditing(false);
            openCustomerDetails(selectedCustomerId);
            fetchCustomers();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaveLoading(false);
        }
    };


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
                                        <div className="text-xs text-slate-400 mt-0.5 flex">
                                            <MaskedContact contact={customer.contact_info || ''} className="truncate" />
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
                                                onClick={() => openCustomerDetails(customer.id)}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-all border border-transparent hover:border-blue-100"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                详情
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

            {/* Slide-over: Customer Details */}
            {isDetailModalOpen && (
                <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity" onClick={() => setIsDetailModalOpen(false)} />
                        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
                            <div className="pointer-events-auto w-screen max-w-2xl transform transition-all duration-500 ease-in-out">
                                <div className="flex h-full flex-col bg-slate-50 shadow-2xl">
                                    <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 sticky top-0 z-10">
                                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2" id="slide-over-title">
                                            <Building2 className="w-5 h-5 text-blue-600" />
                                            客户档案详情
                                        </h2>
                                        <button
                                            type="button"
                                            className="rounded-full p-2 text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none transition-colors"
                                            onClick={() => setIsDetailModalOpen(false)}
                                        >
                                            <span className="sr-only">Close panel</span>
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto">
                                        {detailLoading ? (
                                            <div className="p-10 flex justify-center text-slate-500">加载中...</div>
                                        ) : detailError ? (
                                            <div className="p-10 text-center text-red-500">{detailError}</div>
                                        ) : detailData?.customer ? (
                                            <div className="p-6">
                                                <div className="mb-6">
                                                    <h3 className="text-xl font-bold text-slate-900">{detailData.customer.company_name}</h3>
                                                    <div className="mt-2 text-sm text-slate-500 flex gap-4">
                                                        <span>联系人: {detailData.customer.contact_person}</span>
                                                        <span className="flex items-center">
                                                            电话: <span className="ml-1"><MaskedContact contact={detailData.customer.contact_info} /></span>
                                                        </span>
                                                    </div>
                                                </div>

                                                <Tabs defaultValue="basic" className="w-full">
                                                    <TabsList className="mb-6">
                                                        <TabsTrigger value="basic" className="flex gap-2">
                                                            <FileText className="w-4 h-4" />
                                                            基础档案
                                                        </TabsTrigger>
                                                        <TabsTrigger value="company" className="flex gap-2">
                                                            <Building2 className="w-4 h-4" />
                                                            公司画像
                                                        </TabsTrigger>
                                                        <TabsTrigger value="shareholders" className="flex gap-2">
                                                            <Users className="w-4 h-4" />
                                                            股东信息
                                                        </TabsTrigger>
                                                    </TabsList>

                                                    <TabsContent value="basic" className="focus:outline-none focus:ring-0">
                                                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                                                <h2 className="text-lg font-semibold text-slate-800">基础业务档案</h2>
                                                                {!isEditing ? (
                                                                    <button
                                                                        onClick={() => setIsEditing(true)}
                                                                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition"
                                                                    >
                                                                        编辑
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => { setIsEditing(false); setEditData(detailData.customer); }}
                                                                            className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition"
                                                                        >
                                                                            取消
                                                                        </button>
                                                                        <button
                                                                            onClick={handleSaveEdit}
                                                                            disabled={saveLoading}
                                                                            className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition disabled:opacity-50"
                                                                        >
                                                                            {saveLoading ? '保存中...' : '保存'}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                <div>
                                                                    <label className="block text-sm font-medium text-slate-500 mb-1">企业名称</label>
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                                                                            value={editData.company_name || ''}
                                                                            onChange={e => setEditData({ ...editData, company_name: e.target.value })}
                                                                        />
                                                                    ) : (
                                                                        <div className="text-slate-800">{detailData.customer.company_name}</div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <label className="block text-sm font-medium text-slate-500 mb-1">联系人</label>
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                                                                            value={editData.contact_person || ''}
                                                                            onChange={e => setEditData({ ...editData, contact_person: e.target.value })}
                                                                        />
                                                                    ) : (
                                                                        <div className="text-slate-800">{detailData.customer.contact_person}</div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <label className="block text-sm font-medium text-slate-500 mb-1">联系方式</label>
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                                                                            value={editData.contact_info || ''}
                                                                            onChange={e => setEditData({ ...editData, contact_info: e.target.value })}
                                                                        />
                                                                    ) : (
                                                                        <div className="text-slate-800"><MaskedContact contact={detailData.customer.contact_info} /></div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <label className="block text-sm font-medium text-slate-500 mb-1">企微好友</label>
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                                                                            value={editData.website_member || ''}
                                                                            onChange={e => setEditData({ ...editData, website_member: e.target.value })}
                                                                        />
                                                                    ) : (
                                                                        <div className="text-slate-800">{detailData.customer.website_member_name || detailData.customer.website_member || '未添加'}</div>
                                                                    )}
                                                                </div>
                                                                <div className="md:col-span-2">
                                                                    <label className="block text-sm font-medium text-slate-500 mb-1">通信地址</label>
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                                                                            value={editData.address || ''}
                                                                            onChange={e => setEditData({ ...editData, address: e.target.value })}
                                                                        />
                                                                    ) : (
                                                                        <div className="text-slate-800">{detailData.customer.address || '暂无'}</div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <label className="block text-sm font-medium text-slate-500 mb-1">客户状态</label>
                                                                    {isEditing ? (
                                                                        <select
                                                                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                                                                            value={editData.customer_status || ''}
                                                                            onChange={e => setEditData({ ...editData, customer_status: e.target.value })}
                                                                        >
                                                                            <option value="正常">正常</option>
                                                                            <option value="拖欠户">拖欠户</option>
                                                                            <option value="风险户">风险户</option>
                                                                            <option value="流失">流失</option>
                                                                        </select>
                                                                    ) : (
                                                                        <div className="text-slate-800">{detailData.customer.customer_status}</div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <label className="block text-sm font-medium text-slate-500 mb-1">客户来源</label>
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                                                                            value={editData.source_info || ''}
                                                                            onChange={e => setEditData({ ...editData, source_info: e.target.value })}
                                                                        />
                                                                    ) : (
                                                                        <div className="text-slate-800">{detailData.customer.source_info}</div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <label className="block text-sm font-medium text-slate-500 mb-1">客服经理</label>
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                                                                            value={editData.service_manager || ''}
                                                                            onChange={e => setEditData({ ...editData, service_manager: e.target.value })}
                                                                        />
                                                                    ) : (
                                                                        <div className="text-slate-800">{detailData.customer.service_manager}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TabsContent>

                                                    <TabsContent value="company" className="focus:outline-none focus:ring-0">
                                                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                                                <h2 className="text-lg font-semibold text-slate-800">公司画像</h2>
                                                            </div>
                                                            {detailData.companyProfile ? (
                                                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-slate-500 mb-1">统一社会信用代码</label>
                                                                        <div className="text-slate-800">{detailData.companyProfile.credit_code || '未填写'}</div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-slate-500 mb-1">法定代表人</label>
                                                                        <div className="text-slate-800">{detailData.companyProfile.legal_representative || '未填写'}</div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-slate-500 mb-1">注册资本</label>
                                                                        <div className="text-slate-800">{detailData.companyProfile.registered_capital ? `${detailData.companyProfile.registered_capital}万元` : '未填写'}</div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-slate-500 mb-1">成立日期</label>
                                                                        <div className="text-slate-800">{detailData.companyProfile.establishment_date || '未填写'}</div>
                                                                    </div>
                                                                    <div className="md:col-span-2">
                                                                        <label className="block text-sm font-medium text-slate-500 mb-1">经营范围</label>
                                                                        <div className="text-slate-800 text-sm whitespace-pre-wrap">{detailData.companyProfile.business_scope || '未填写'}</div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="p-10 text-center text-slate-500 flex flex-col items-center">
                                                                    <Building2 className="w-12 h-12 mb-4 text-slate-300" />
                                                                    <h3 className="text-lg font-medium text-slate-800 mb-2">暂无公司画像</h3>
                                                                    <p className="mb-4">该客户尚未建立公司画像，如工商、税务等详细信息。</p>
                                                                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">建立公司画像</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TabsContent>

                                                    <TabsContent value="shareholders" className="focus:outline-none focus:ring-0">
                                                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                                                <h2 className="text-lg font-semibold text-slate-800">股东与高管</h2>
                                                                <button className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition">添加股东</button>
                                                            </div>
                                                            {detailData.shareholders?.length > 0 ? (
                                                                <div className="divide-y divide-slate-100">
                                                                    {detailData.shareholders.map((sh: any) => (
                                                                        <div key={sh.id} className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 hover:bg-slate-50/50 transition-colors">
                                                                            <div>
                                                                                <div className="text-sm font-medium text-slate-500 mb-1">股东姓名</div>
                                                                                <div className="font-semibold text-slate-800">{sh.name}</div>
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-sm font-medium text-slate-500 mb-1">持股比例</div>
                                                                                <div className="text-slate-800">{sh.share_ratio}%</div>
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-sm font-medium text-slate-500 mb-1">联系电话</div>
                                                                                <div className="text-slate-800"><MaskedContact contact={sh.contact_number || ''} /></div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="p-10 text-center text-slate-500 flex flex-col items-center">
                                                                    <Users className="w-12 h-12 mb-4 text-slate-300" />
                                                                    <h3 className="text-lg font-medium text-slate-800 mb-2">暂无股东信息</h3>
                                                                    <p className="mb-4">您还没有登记任何股东或高管成员信息。</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TabsContent>
                                                </Tabs>
                                            </div>
                                        ) : null}
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
