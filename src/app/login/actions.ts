'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// ---------------------------------------------------------------------------
// Lockout rules
// ---------------------------------------------------------------------------
// 1-4  failures  → accumulate only
// 5th  failure   → lock 30 minutes
// 6-9  failures  → accumulate (still locked from #5)
// 10th failure   → lock 24 hours
// Successful login → reset everything
// ---------------------------------------------------------------------------

const LOCK_THRESHOLDS: { count: number; minutes: number }[] = [
    { count: 5, minutes: 30 },
    { count: 10, minutes: 24 * 60 },
]

function getLockDuration(failedCount: number): number | null {
    // Walk thresholds in reverse so the highest match wins
    for (let i = LOCK_THRESHOLDS.length - 1; i >= 0; i--) {
        if (failedCount >= LOCK_THRESHOLDS[i].count) {
            return LOCK_THRESHOLDS[i].minutes
        }
    }
    return null
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(formData: FormData) {
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')

    if (!email || !password) {
        return { error: '请输入邮箱和密码' }
    }

    const admin = createAdminClient()

    // 1. Check if account is currently locked
    const { data: guard } = await admin
        .from('auth_login_guards')
        .select('failed_count, locked_until')
        .eq('email', email)
        .maybeSingle()

    if (guard?.locked_until) {
        const lockedUntil = new Date(guard.locked_until)
        if (lockedUntil > new Date()) {
            const mins = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)
            if (mins >= 60) {
                const hours = Math.ceil(mins / 60)
                return { error: `账号已被暂时锁定，请 ${hours} 小时后再试` }
            }
            return { error: `账号已被暂时锁定，请 ${mins} 分钟后再试` }
        }
    }

    // 2. Attempt Supabase Auth sign-in (cookie-based client)
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
        // 3. Login failed → increment failure count
        const currentCount = guard?.failed_count ?? 0
        const newCount = currentCount + 1
        const lockMinutes = getLockDuration(newCount)

        const upsertPayload: Record<string, unknown> = {
            email,
            failed_count: newCount,
            last_failed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        if (lockMinutes !== null) {
            upsertPayload.locked_until = new Date(
                Date.now() + lockMinutes * 60 * 1000
            ).toISOString()
        }

        await admin
            .from('auth_login_guards')
            .upsert(upsertPayload, { onConflict: 'email' })

        if (lockMinutes !== null) {
            if (lockMinutes >= 60) {
                const hours = Math.ceil(lockMinutes / 60)
                return { error: `密码错误次数过多，账号已被锁定 ${hours} 小时` }
            }
            return { error: `密码错误次数过多，账号已被锁定 ${lockMinutes} 分钟` }
        }

        return { error: '登录失败，请检查账号和密码' }
    }

    // 4. Login succeeded → reset guard
    if (guard) {
        await admin
            .from('auth_login_guards')
            .update({
                failed_count: 0,
                locked_until: null,
                last_failed_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq('email', email)
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
