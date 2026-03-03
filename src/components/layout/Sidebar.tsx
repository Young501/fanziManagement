'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Settings, Database, Server, Briefcase, ChevronDown, ChevronRight } from 'lucide-react';

type NavItem = {
    name: string;
    href?: string;
    icon: any;
    subItems?: { name: string; href: string }[];
};

const navItems: NavItem[] = [
    { name: '仪表盘', href: '/', icon: LayoutDashboard },
    {
        name: '商务与客户',
        icon: Briefcase,
        subItems: [
            { name: '客户档案', href: '/customers' }
        ]
    },
    { name: '用户管理', href: '/users', icon: Users },
    { name: '数据模型', href: '/models', icon: Database },
    { name: '服务配置', href: '/services', icon: Server },
    { name: '系统设置', href: '/settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    // Auto-expand group if a sub-item is active
    useEffect(() => {
        navItems.forEach(item => {
            if (item.subItems && item.subItems.some(sub => pathname.startsWith(sub.href))) {
                setExpandedGroups(prev => ({ ...prev, [item.name]: true }));
            }
        });
    }, [pathname]);

    const toggleGroup = (name: string) => {
        setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
    };

    return (
        <aside className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col flex-shrink-0 transition-all duration-300">
            <div className="h-16 flex items-center px-6 border-b border-slate-200">
                <img
                    src="/logo.png"
                    alt="公司 Logo"
                    className="h-8 max-w-full mr-3 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <span className="text-xl font-bold text-slate-800">
                    管理台
                </span>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto styled-scrollbar">
                {navItems.map((item) => {
                    const hasSubItems = !!item.subItems;
                    const isActiveExact = pathname === item.href;
                    const isGroupActive = hasSubItems && item.subItems!.some(sub => pathname.startsWith(sub.href));
                    const isExpanded = expandedGroups[item.name];
                    const Icon = item.icon;

                    if (hasSubItems) {
                        return (
                            <div key={item.name} className="space-y-1">
                                <button
                                    onClick={() => toggleGroup(item.name)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${isGroupActive ? 'bg-blue-50/50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                >
                                    <div className="flex items-center">
                                        <Icon className={`w-5 h-5 mr-3 transition-colors ${isGroupActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                        <span>{item.name}</span>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronDown className={`w-4 h-4 transition-colors ${isGroupActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                    ) : (
                                        <ChevronRight className={`w-4 h-4 transition-colors ${isGroupActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                    )}
                                </button>

                                {isExpanded && (
                                    <div className="pl-11 pr-2 py-1 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                                        {item.subItems!.map((sub) => {
                                            const isSubActive = pathname === sub.href;
                                            return (
                                                <Link
                                                    key={sub.href}
                                                    href={sub.href}
                                                    className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors relative ${isSubActive
                                                            ? 'text-blue-700 bg-blue-50/80 font-semibold'
                                                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    {isSubActive && (
                                                        <div className="absolute left-[-5px] top-[10%] bottom-[10%] w-1 bg-blue-600 rounded-r-md"></div>
                                                    )}
                                                    <span>{sub.name}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={item.name}
                            href={item.href!}
                            className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${isActiveExact
                                ? 'bg-blue-50 text-blue-600 font-semibold'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            {isActiveExact && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-md"></div>
                            )}
                            <Icon className={`w-5 h-5 mr-3 transition-colors ${isActiveExact ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-200">
                <div className="flex items-center p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                        AD
                    </div>
                    <div className="ml-3 flex-1 overflow-hidden">
                        <p className="text-sm font-medium text-slate-800 truncate">Admin User</p>
                        <p className="text-xs text-slate-500 truncate">admin@company.com</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
