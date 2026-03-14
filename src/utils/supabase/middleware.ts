import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { maxAge, expires, ...sessionOptions } = options
                        supabaseResponse.cookies.set(name, value, sessionOptions)
                    })
                },
            },
        }
    )

    // refreshing the auth token
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const isLoginPage = request.nextUrl.pathname.startsWith('/login')
    const isApiRoute = request.nextUrl.pathname.startsWith('/api')

    // 如果未登录 && 当前不是在 login 页，那么重定向到登录界面
    // API 路由返回 401 而不是重定向
    if (!user && !isLoginPage) {
        if (isApiRoute) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // 如果已登录 && 当前是在 login 页，那么重定向到主页
    if (user && isLoginPage) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
