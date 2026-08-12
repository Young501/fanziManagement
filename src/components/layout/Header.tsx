"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Bell, LogOut, Menu, Search } from "lucide-react";

import { logout } from "@/app/login/actions";
import { useToast } from "@/components/ui/feedback";

const pageTitles = [
    { match: /^\/$/, title: "仪表盘", subtitle: "经营概况与待处理事项" },
    { match: /^\/customers\/new/, title: "新增客户", subtitle: "建档、合同和首期收款" },
    { match: /^\/customers\/churn/, title: "流失客户", subtitle: "登记与复盘客户流失" },
    { match: /^\/customers/, title: "客户档案", subtitle: "基础资料、画像和股东信息" },
    { match: /^\/finance\/customers/, title: "客户账款", subtitle: "应收、实收和账期管理" },
    { match: /^\/finance\/collection-tasks/, title: "催款任务", subtitle: "跟进逾期与本期待收款" },
    { match: /^\/finance\/payment/, title: "收款记录", subtitle: "登记、核对和导出收款" },
    { match: /^\/finance\/expenses/, title: "成本记录", subtitle: "登记、核对和导出成本" },
    { match: /^\/resources\/contracts\/new/, title: "合同信息录入", subtitle: "新建合同与附件归档" },
    { match: /^\/resources\/contracts/, title: "合同管理", subtitle: "合同状态与履约信息" },
    { match: /^\/accounting\/dividend/, title: "股东分红", subtitle: "分红核算与历史记录" },
] as const;

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const toast = useToast();
    const [query, setQuery] = useState("");

    const currentPage = useMemo(() => {
        return pageTitles.find((item) => item.match.test(pathname)) || {
            title: "管理平台",
            subtitle: "范咨内部运营工作台",
        };
    }, [pathname]);

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const keyword = query.trim();

        if (!keyword) {
            toast.info({ title: "输入客户名称或联系人后再搜索" });
            return;
        }

        router.push(`/customers?search=${encodeURIComponent(keyword)}`);
    }

    return (
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        type="button"
                        onClick={onMenuClick}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden"
                        aria-label="打开菜单"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <div className="hidden min-w-0 sm:block">
                        <h1 className="truncate text-base font-semibold text-slate-900">{currentPage.title}</h1>
                        <p className="truncate text-xs text-slate-500">{currentPage.subtitle}</p>
                    </div>
                </div>

                <form onSubmit={handleSearch} className="relative hidden w-full max-w-md md:block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="block h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        placeholder="搜索客户名称、联系人"
                    />
                </form>

                <div className="flex items-center gap-1 sm:gap-2">
                    <Link
                        href="/finance/collection-tasks?tab=overdue"
                        className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        title="查看逾期催款任务"
                    >
                        <Bell className="h-5 w-5" />
                        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                    </Link>

                    <div className="mx-1 h-5 w-px bg-slate-200" />

                    <form action={logout}>
                        <button
                            type="submit"
                            className="flex items-center gap-2 rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 sm:px-3"
                            title="退出登录"
                        >
                            <LogOut className="h-5 w-5" />
                            <span className="hidden text-sm font-medium sm:inline">退出</span>
                        </button>
                    </form>
                </div>
            </div>
        </header>
    );
}
