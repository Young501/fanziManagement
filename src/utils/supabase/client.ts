import { createBrowserClient } from '@supabase/ssr'

// 解析 document.cookie 中指定名称的值
function getCookieValue(name: string): string | undefined {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined
}

// 写入不带 maxAge / expires 的 session cookie（浏览器关闭即失效）
function setSessionCookie(name: string, value: string, path = '/') {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=${path}; SameSite=Lax`
}

// 删除 cookie（设置过期时间为过去）
function deleteCookie(name: string, path = '/') {
  document.cookie = `${name}=; path=${path}; Max-Age=0`
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        get: (name) => getCookieValue(name),
        set: (name, value, options) => setSessionCookie(name, value, options?.path),
        remove: (name, options) => deleteCookie(name, options?.path),
      },
    }
  )
}
