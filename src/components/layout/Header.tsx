'use client';

import { Bell, Search, Menu, LogOut } from 'lucide-react';
import { logout } from '@/app/login/actions';

export function Header() {
    return (
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 sticky top-0 z-10 transition-all duration-300">
            <div className="flex items-center flex-1">
                <button className="p-2 mr-4 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors lg:hidden">
                    <Menu className="w-5 h-5" />
                </button>

                <div className="max-w-md w-full relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-all duration-200"
                        placeholder="搜索资源、用户或文档..."
                    />
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <button className="relative p-2 text-slate-500 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors">
                    <Bell className="w-5 h-5 hover:scale-110 transition-transform" />
                    <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                </button>

                <div className="h-5 w-px bg-slate-200 mx-2"></div>

                <form action={logout}>
                    <button
                        type="submit"
                        className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors flex items-center group"
                        title="退出登录"
                    >
                        <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </button>
                </form>
            </div>
        </header>
    );
}
