import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 selection:bg-blue-200">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden relative z-10">
                <Header />
                <main className="flex-1 overflow-y-auto p-6 md:p-8 styled-scrollbar bg-slate-50 relative">
                    {/* Subtle top background glow */}
                    <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-blue-100/50 to-transparent pointer-events-none -z-10" />

                    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
