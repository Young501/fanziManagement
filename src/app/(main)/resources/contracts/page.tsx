'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, X, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

type Contract = {
    id: string;
    customer_id: string;
    contract_number: string;
    contract_name: string;
    amount: number;
    start_date: string;
    end_date: string;
    status: string;
    signing_date: string;
    customers: {
        company_name: string;
    };
};

type PaginatedContracts = {
    data: Contract[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

const LIMIT = 10;

export default function ContractsPage() {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const fetchContracts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(LIMIT),
                search,
            });
            const res = await fetch(`/api/contracts?${params.toString()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const json: PaginatedContracts = await res.json();
            setContracts(json.data);
            setTotal(json.total);
            setTotalPages(json.totalPages);
        } catch (err: any) {
            setError(err.message ?? '加载失败');
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        fetchContracts();
    }, [fetchContracts]);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case '执行中':
                return 'bg-emerald-100 text-emerald-700';
            case '已归档':
                return 'bg-slate-100 text-slate-700';
            case '已终止':
                return 'bg-red-100 text-red-700';
            default:
                return 'bg-blue-100 text-blue-700';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">合同管理</h1>
                    <p className="text-sm text-slate-500 mt-1">管理客户合同、金额、周期与状态</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50">
                    <div className="relative max-w-sm w-full">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="搜索合同编号、名称或客户"
                            className="block w-full rounded-xl border-0 py-2.5 pl-10 pr-9 text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 transition-all"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                        {searchInput && (
                            <button
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                                onClick={() => setSearchInput('')}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80">
                                <th scope="col" className="w-[20%] py-3.5 pl-6 pr-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">合同编号/名称</th>
                                <th scope="col" className="w-[20%] px-4 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">客户</th>
                                <th scope="col" className="w-[15%] px-4 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">合同金额</th>
                                <th scope="col" className="w-[20%] px-4 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">起止日期</th>
                                <th scope="col" className="w-[10%] px-4 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest">状态</th>
                                <th scope="col" className="w-[15%] py-3.5 pl-4 pr-6 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-widest">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading && Array.from({ length: 5 }).map((_, i) => (
                                <tr key={`skeleton-${i}`} className="animate-pulse">
                                    <td className="py-5 pl-6 pr-3"><div className="h-4 bg-slate-100 rounded w-3/4"></div></td>
                                    <td className="px-4 py-5"><div className="h-4 bg-slate-100 rounded w-1/2"></div></td>
                                    <td className="px-4 py-5"><div className="h-4 bg-slate-100 rounded w-1/3"></div></td>
                                    <td className="px-4 py-5"><div className="h-4 bg-slate-100 rounded w-2/3"></div></td>
                                    <td className="px-4 py-5"><div className="h-6 bg-slate-100 rounded-full w-16"></div></td>
                                    <td className="py-5 pl-4 pr-6 text-center"><div className="h-6 bg-slate-100 rounded w-12 mx-auto"></div></td>
                                </tr>
                            ))}

                            {!loading && error && (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-red-500">
                                        加载失败：{error}
                                    </td>
                                </tr>
                            )}

                            {!loading && !error && contracts.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-slate-500">
                                        <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                                        暂无合同数据
                                    </td>
                                </tr>
                            )}

                            {!loading && !error && contracts.map((contract) => (
                                <tr key={contract.id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="py-4 pl-6 pr-3">
                                        <div className="font-semibold text-slate-800 text-sm truncate" title={contract.contract_name}>
                                            {contract.contract_name}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                                            {contract.contract_number || '-'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="text-sm font-medium text-slate-700 truncate" title={contract.customers?.company_name}>
                                            {contract.customers?.company_name || '未知客户'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="text-sm font-semibold text-slate-800">
                                            ￥{Number(contract.amount || 0).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="text-xs text-slate-600">
                                            <div>起：{contract.start_date || '-'}</div>
                                            <div>止：{contract.end_date || '-'}</div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-left">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusStyle(contract.status)}`}>
                                            {contract.status}
                                        </span>
                                    </td>
                                    <td className="py-4 pl-4 pr-6 text-center">
                                        <button className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline">
                                            详情
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                        第<span className="font-semibold text-slate-700">{total === 0 ? 0 : (page - 1) * LIMIT + 1}</span>
                        -
                        <span className="font-semibold text-slate-700">{Math.min(page * LIMIT, total)}</span> 条 / 共
                        <span className="font-semibold text-slate-700">{total}</span> 条
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1 || loading}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-transparent hover:border-slate-200"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-slate-600 px-2">{page} / {totalPages || 1}</span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
                            disabled={page >= totalPages || loading}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-transparent hover:border-slate-200"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

