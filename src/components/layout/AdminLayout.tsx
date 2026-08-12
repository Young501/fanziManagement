"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-[#f6f7fb] text-slate-900 selection:bg-blue-200">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex flex-col flex-1 overflow-hidden relative z-10">
                <Header onMenuClick={() => setSidebarOpen(true)} />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 styled-scrollbar bg-[#f6f7fb] relative">
                    <div className="mx-auto max-w-[1440px] animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
