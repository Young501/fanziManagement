"use client";

import Image from "next/image";
import { useState } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";

import { login } from "./actions";

const LAST_EMAIL_KEY = "fanzish:last-login-email";

function isRedirectSignal(error: unknown) {
    if (!error || typeof error !== "object" || !("digest" in error)) return false;
    return String((error as { digest?: unknown }).digest).includes("NEXT_REDIRECT");
}

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState(() => {
        if (typeof window === "undefined") return "";
        return window.localStorage.getItem(LAST_EMAIL_KEY) || "";
    });
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    async function handleSubmit(formData: FormData) {
        const submittedEmail = String(formData.get("email") ?? "").trim().toLowerCase();
        const submittedPassword = String(formData.get("password") ?? "");

        if (!submittedEmail || !submittedPassword) {
            setError("请填写邮箱和密码");
            return;
        }

        if (!submittedEmail.includes("@")) {
            setError("请输入有效的邮箱地址");
            return;
        }

        setLoading(true);
        setError(null);
        window.localStorage.setItem(LAST_EMAIL_KEY, submittedEmail);

        try {
            const result = await login(formData);
            if (result?.error) {
                setError(result.error);
                setLoading(false);
            }
        } catch (err) {
            if (isRedirectSignal(err)) throw err;
            setError("登录请求未完成，请稍后再试");
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#f6f7fb] px-4 py-6 text-slate-900 sm:px-6">
            <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-950/5 lg:grid-cols-[0.95fr_1.05fr]">
                <section className="hidden border-r border-slate-200 bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
                    <div>
                        <Image src="/logo.png" alt="范咨管理台" width={150} height={48} className="h-11 w-auto brightness-0 invert" priority />
                        <div className="mt-14 max-w-sm">
                            <p className="text-sm font-medium text-blue-200">内部运营入口</p>
                            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-normal">
                                让客户、合同与账款在同一个节奏里运转。
                            </h1>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm text-slate-300">
                        <div className="border-t border-white/15 pt-3">
                            <div className="text-lg font-semibold text-white">客户</div>
                            <div className="mt-1">档案与画像</div>
                        </div>
                        <div className="border-t border-white/15 pt-3">
                            <div className="text-lg font-semibold text-white">财务</div>
                            <div className="mt-1">收款与成本</div>
                        </div>
                        <div className="border-t border-white/15 pt-3">
                            <div className="text-lg font-semibold text-white">合约</div>
                            <div className="mt-1">履约与归档</div>
                        </div>
                    </div>
                </section>

                <section className="flex items-center justify-center p-6 sm:p-10">
                    <div className="w-full max-w-sm">
                        <div className="mb-8 lg:hidden">
                            <Image src="/logo.png" alt="范咨管理台" width={140} height={44} className="h-10 w-auto" priority />
                        </div>

                        <div className="mb-8">
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                <LockKeyhole className="h-5 w-5" />
                            </div>
                            <h2 className="text-2xl font-semibold tracking-normal text-slate-950">登录管理平台</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-500">使用已开通权限的工作邮箱进入后台。</p>
                        </div>

                        <form action={handleSubmit} className="space-y-5">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="email">
                                    邮箱地址
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    autoComplete="email"
                                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    placeholder="name@company.com"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="password">
                                    密码
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        autoComplete="current-password"
                                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 pr-11 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        placeholder="请输入密码"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        className="absolute right-2 top-1/2 rounded-md p-2 -translate-y-1/2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                        aria-label={showPassword ? "隐藏密码" : "显示密码"}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {loading ? "正在登录" : "登录"}
                            </button>
                        </form>
                    </div>
                </section>
            </div>
        </main>
    );
}
