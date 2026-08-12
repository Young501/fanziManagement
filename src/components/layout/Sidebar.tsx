"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGroup, motion } from "framer-motion";
import {
    Banknote,
    Briefcase,
    Building2,
    ChevronDown,
    ChevronRight,
    LayoutDashboard,
    ShieldCheck,
    X,
    type LucideIcon,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

type NavLeaf = {
    name: string;
    href: string;
};

type NavItem = {
    name: string;
    href?: string;
    icon: LucideIcon;
    subItems?: NavLeaf[];
};

type UserProfile = {
    fullName: string;
    email: string;
    initial: string;
    role: string;
};

const navItems: NavItem[] = [
    { name: "仪表盘", href: "/", icon: LayoutDashboard },
    {
        name: "公司核算",
        icon: Building2,
        subItems: [{ name: "股东分红", href: "/accounting/dividend" }],
    },
    {
        name: "商务与客户",
        icon: Briefcase,
        subItems: [
            { name: "客户档案", href: "/customers" },
            { name: "新增客户", href: "/customers/new" },
            { name: "流失客户", href: "/customers/churn" },
        ],
    },
    {
        name: "财务中心",
        icon: Banknote,
        subItems: [
            { name: "客户账款", href: "/finance/customers" },
            { name: "催款任务", href: "/finance/collection-tasks" },
            { name: "收款记录", href: "/finance/payment" },
            { name: "成本记录", href: "/finance/expenses" },
        ],
    },
    {
        name: "资源与合约",
        icon: ShieldCheck,
        subItems: [
            { name: "合同管理", href: "/resources/contracts" },
            { name: "合同信息录入", href: "/resources/contracts/new" },
        ],
    },
];

const slideTransition = {
    type: "spring",
    stiffness: 420,
    damping: 36,
    mass: 0.65,
} as const;

function isCustomersDetailPath(pathname: string) {
    return /^\/customers\/[^/]+(?:\/churn)?$/.test(pathname);
}

function isActiveHref(pathname: string, href?: string) {
    if (!href) return false;
    if (href === "/") return pathname === "/";
    if (href === "/customers") {
        return pathname === href || isCustomersDetailPath(pathname);
    }
    return pathname === href;
}

function isGroupActive(pathname: string, item: NavItem) {
    if (isActiveHref(pathname, item.href)) return true;
    return item.subItems?.some((sub) => isActiveHref(pathname, sub.href)) ?? false;
}

function roleLabel(role: string) {
    const normalized = role.toLowerCase();
    if (normalized === "admin") return "管理员";
    if (normalized === "manager") return "经理";
    return "成员";
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
    const pathname = usePathname();
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchUserProfile = async () => {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user || cancelled) return;

            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, role")
                .eq("id", user.id)
                .maybeSingle();

            const email = user.email || "";
            const fullName = profile?.full_name || email.split("@")[0] || "Admin User";
            const role = profile?.role || "user";
            const initial = fullName.trim().charAt(0).toUpperCase() || "A";

            if (!cancelled) {
                setUserProfile({ fullName, email, initial, role });
            }
        };

        fetchUserProfile();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <>
            <div
                className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity lg:hidden ${
                    open ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                onClick={onClose}
                aria-hidden="true"
            />

            <aside
                className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-shrink-0 flex-col border-r border-slate-200 bg-white shadow-2xl shadow-slate-950/10 transition-transform duration-300 lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:shadow-none ${
                    open ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
                    <Link href="/" onClick={onClose} className="flex min-w-0 items-center gap-3">
                        <Image src="/logo.png" alt="范咨管理台" width={112} height={36} className="h-8 w-auto object-contain" priority />
                        <span className="sr-only">范咨管理台</span>
                    </Link>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
                        aria-label="关闭菜单"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <LayoutGroup id="sidebar-nav-slide">
                    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 styled-scrollbar">
                        {navItems.map((item) => {
                            const hasSubItems = !!item.subItems?.length;
                            const active = isGroupActive(pathname, item);
                            const isExpanded = expandedGroups[item.name] ?? active;
                            const Icon = item.icon;

                            if (hasSubItems) {
                                return (
                                    <div key={item.name} className="space-y-1">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedGroups((prev) => ({ ...prev, [item.name]: !isExpanded }))}
                                            aria-expanded={isExpanded}
                                            className={`group flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                                                active
                                                    ? "border-blue-100 bg-blue-50 text-blue-700"
                                                    : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                                            }`}
                                        >
                                            <span className="flex min-w-0 items-center gap-3">
                                                <Icon className={`h-5 w-5 ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                                                <span className="truncate">{item.name}</span>
                                            </span>
                                            {isExpanded ? (
                                                <ChevronDown className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-400"}`} />
                                            ) : (
                                                <ChevronRight className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-400"}`} />
                                            )}
                                        </button>

                                        <div
                                            className={`grid transition-[grid-template-rows,opacity] duration-200 ${
                                                isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                            }`}
                                        >
                                            <div className="overflow-hidden">
                                                <div className="space-y-1 py-1 pl-9 pr-1">
                                                    {item.subItems?.map((sub) => {
                                                        const subActive = isActiveHref(pathname, sub.href);

                                                        return (
                                                            <Link
                                                                key={sub.href}
                                                                href={sub.href}
                                                                onClick={onClose}
                                                                className={`group relative flex items-center rounded-lg border px-3 py-2 text-sm transition ${
                                                                    subActive
                                                                        ? "border-blue-100 text-blue-700"
                                                                        : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800"
                                                                }`}
                                                            >
                                                                {subActive && (
                                                                    <>
                                                                        <motion.span
                                                                            layoutId="sidebar-active-pill"
                                                                            transition={slideTransition}
                                                                            className="absolute inset-0 rounded-lg bg-blue-50"
                                                                        />
                                                                        <motion.span
                                                                            layoutId="sidebar-active-rail"
                                                                            transition={slideTransition}
                                                                            className="absolute left-[-6px] top-[18%] bottom-[18%] w-1 rounded-r-md bg-blue-600"
                                                                        />
                                                                    </>
                                                                )}
                                                                <span className="relative z-10 truncate">{sub.name}</span>
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href || "/"}
                                    onClick={onClose}
                                    className={`group relative flex items-center rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                                        active
                                            ? "border-blue-100 text-blue-700"
                                            : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                                    }`}
                                >
                                    {active && (
                                        <>
                                            <motion.span
                                                layoutId="sidebar-active-pill"
                                                transition={slideTransition}
                                                className="absolute inset-0 rounded-lg bg-blue-50"
                                            />
                                            <motion.span
                                                layoutId="sidebar-active-rail"
                                                transition={slideTransition}
                                                className="absolute left-0 top-[18%] bottom-[18%] w-1 rounded-r-md bg-blue-600"
                                            />
                                        </>
                                    )}
                                    <Icon className={`relative z-10 mr-3 h-5 w-5 ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                                    <span className="relative z-10 truncate">{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </LayoutGroup>

                <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                            {userProfile?.initial || "A"}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                                <p className="truncate text-sm font-semibold text-slate-900">{userProfile?.fullName || "加载中"}</p>
                                <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                                    {roleLabel(userProfile?.role || "user")}
                                </span>
                            </div>
                            <p className="truncate text-xs text-slate-500">{userProfile?.email || "正在读取账户信息"}</p>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
