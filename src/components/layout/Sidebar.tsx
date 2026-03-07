'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { Banknote, Briefcase, ChevronDown, ChevronRight, LayoutDashboard, ShieldCheck, type LucideIcon } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

type NavItem = {
    name: string;
    href?: string;
    icon: LucideIcon;
    subItems?: { name: string; href: string }[];
};

const navItems: NavItem[] = [
    { name: '仪表盘', href: '/', icon: LayoutDashboard },
    {
        name: '商务与客户',
        icon: Briefcase,
        subItems: [
            { name: '客户档案', href: '/customers' },
            { name: '新客户建档', href: '/customers/new' },
            { name: '客户流失登记', href: '/customers/churn' }
        ]
    },
    {
        name: '财务中心',
        icon: Banknote,
        subItems: [
            { name: '客户信息', href: '/finance/customers' },
            { name: '收款录入', href: '/finance/payment' },
            { name: '催款任务', href: '/finance/collection-tasks' }
        ]
    },
    {
        name: '资源与合约',
        icon: ShieldCheck,
        subItems: [
            { name: '合同管理', href: '/resources/contracts' },
            { name: '合同信息录入', href: '/resources/contracts/new' }
        ]
    }
];

const slideTransition = {
    type: 'spring',
    stiffness: 420,
    damping: 36,
    mass: 0.65
} as const;

export function Sidebar() {
    const pathname = usePathname();
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [userProfile, setUserProfile] = useState<{ fullName: string; email: string; initial: string } | null>(null);

    useEffect(() => {
        navItems.forEach((item) => {
            if (item.subItems && item.subItems.some((sub) => pathname.startsWith(sub.href))) {
                setExpandedGroups((prev) => ({ ...prev, [item.name]: true }));
            }
        });
    }, [pathname]);

    useEffect(() => {
        const fetchUserProfile = async () => {
            const supabase = createClient();
            const {
                data: { user }
            } = await supabase.auth.getUser();

            if (user) {
                const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
                const email = user.email || '';
                let fullName = profile?.full_name;

                if (!fullName && email) {
                    fullName = email.split('@')[0];
                }

                fullName = fullName || 'Admin User';
                const initial = fullName.charAt(0).toUpperCase() || 'A';
                setUserProfile({ fullName, email, initial });
            }
        };

        fetchUserProfile();
    }, []);

    const toggleGroup = (name: string) => {
        setExpandedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
    };

    return (
        <aside className="w-64 h-screen bg-gradient-to-b from-white via-slate-50/90 to-slate-100/95 border-r border-slate-200/80 flex flex-col flex-shrink-0">
            <div className="h-16 flex items-center px-6 border-b border-slate-200/80">
                <img
                    src="/logo.png"
                    alt="鍏徃 Logo"
                    className="h-8 max-w-full mr-3 object-contain"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
                <span className="text-xl font-bold text-slate-800 tracking-wide">管理台</span>
            </div>

            <LayoutGroup id="sidebar-nav-slide">
                <nav className="flex-1 px-3 py-5 space-y-2 overflow-y-auto styled-scrollbar">
                    {navItems.map((item) => {
                        const hasSubItems = !!item.subItems;
                        const isActiveExact = pathname === item.href;
                        const isGroupActive = hasSubItems && item.subItems!.some((sub) => pathname.startsWith(sub.href));
                        const isExpanded = !!expandedGroups[item.name];
                        const Icon = item.icon;

                        if (hasSubItems) {
                            return (
                                <div key={item.name} className="space-y-1.5">
                                    <button
                                        onClick={() => toggleGroup(item.name)}
                                        className={`group w-full relative flex items-center justify-between px-4 py-3 rounded-xl border transition-[transform,background-color,color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                            isGroupActive
                                                ? 'bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 font-semibold border-blue-100'
                                                : 'border-transparent text-slate-600 hover:bg-white hover:text-slate-900 hover:border-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center relative z-10">
                                            <Icon
                                                className={`w-5 h-5 mr-3 transition-colors duration-300 ${
                                                    isGroupActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                                                }`}
                                            />
                                            <span>{item.name}</span>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronDown
                                                className={`w-4 h-4 transition-all duration-300 relative z-10 ${
                                                    isGroupActive ? 'text-blue-600' : 'text-slate-400'
                                                }`}
                                            />
                                        ) : (
                                            <ChevronRight
                                                className={`w-4 h-4 transition-all duration-300 relative z-10 ${
                                                    isGroupActive ? 'text-blue-600' : 'text-slate-400'
                                                }`}
                                            />
                                        )}
                                    </button>

                                    <div
                                        className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                            isExpanded ? 'grid-rows-[1fr] opacity-100 translate-y-0' : 'grid-rows-[0fr] opacity-70 -translate-y-1'
                                        }`}
                                    >
                                        <div className="overflow-hidden">
                                            <div className="pl-11 pr-2 py-1.5 space-y-1">
                                                {item.subItems!.map((sub) => {
                                                    const isSubActive = pathname === sub.href;

                                                    return (
                                                        <Link
                                                            key={sub.href}
                                                            href={sub.href}
                                                            className={`group relative flex items-center px-3 py-2 text-sm rounded-lg border transition-[transform,background-color,color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                                                isSubActive
                                                                    ? 'text-blue-700 font-semibold border-blue-100'
                                                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/90 hover:border-slate-200'
                                                            }`}
                                                        >
                                                            {isSubActive && (
                                                                <>
                                                                    <motion.span
                                                                        layoutId="sidebar-active-pill"
                                                                        transition={slideTransition}
                                                                        className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50"
                                                                    />
                                                                    <motion.span
                                                                        layoutId="sidebar-active-rail"
                                                                        transition={slideTransition}
                                                                        className="absolute left-[-6px] top-[16%] bottom-[16%] w-1 rounded-r-md bg-blue-500"
                                                                    />
                                                                </>
                                                            )}
                                                            <span className="relative z-10">{sub.name}</span>
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
                                href={item.href!}
                                className={`group relative flex items-center px-4 py-3 rounded-xl border transition-[transform,background-color,color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden ${
                                    isActiveExact
                                        ? 'text-blue-700 font-semibold border-blue-100'
                                        : 'border-transparent text-slate-600 hover:bg-white hover:text-slate-900 hover:border-slate-200'
                                }`}
                            >
                                {isActiveExact && (
                                    <>
                                        <motion.span
                                            layoutId="sidebar-active-pill"
                                            transition={slideTransition}
                                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50"
                                        />
                                        <motion.span
                                            layoutId="sidebar-active-rail"
                                            transition={slideTransition}
                                            className="absolute left-0 top-[14%] bottom-[14%] w-1 rounded-r-md bg-blue-500"
                                        />
                                    </>
                                )}
                                <Icon
                                    className={`w-5 h-5 mr-3 relative z-10 transition-colors duration-300 ${
                                        isActiveExact ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                                    }`}
                                />
                                <span className="relative z-10">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
            </LayoutGroup>

            <div className="p-4 border-t border-slate-200/80 bg-white/60 backdrop-blur">
                <div className="flex items-center p-3 rounded-xl border border-transparent hover:border-slate-200 hover:bg-white transition-[background-color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {userProfile?.initial || 'AD'}
                    </div>
                    <div className="ml-3 flex-1 overflow-hidden">
                        <p className="text-sm font-semibold text-slate-800 truncate">{userProfile?.fullName || 'Admin User'}</p>
                        <p className="text-xs text-slate-500 truncate">{userProfile?.email || 'admin@company.com'}</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}




