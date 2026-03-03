'use client';

import { useState } from 'react';
import { login } from './actions';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        setError(null);
        const result = await login(formData);
        if (result && result.error) {
            setError(result.error);
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 font-sans text-slate-900 relative overflow-hidden bg-slate-50">
            {/* Premium Animated Gradient Background */}
            <div className="absolute inset-0 z-0 opacity-40 mix-blend-multiply">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/30 blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
                <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[60%] rounded-full bg-cyan-300/20 blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
            </div>

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 z-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20" />

            <div className="max-w-md w-full bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 p-8 sm:p-10 transition-all relative z-10">
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-6">
                        <img
                            src="/logo.png"
                            alt="范咨管理台 Logo"
                            className="h-12 w-auto object-contain"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                // Fallback style if logo not found
                                e.currentTarget.insertAdjacentHTML('afterend', '<div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xl">FC</div>');
                            }}
                        />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">欢迎登录系统</h2>
                    <p className="text-slate-500 text-sm mt-2">请输入您的工作邮箱和密码进行访问</p>
                </div>

                <form action={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">邮箱地址</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="admin@company.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="password">密码</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start">
                            <span className="block">{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-2.5 px-4 mt-6 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '登录'}
                    </button>
                </form>
            </div>
        </div>
    );
}
