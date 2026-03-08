import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with the service_role key.
 * This client bypasses RLS and should ONLY be used in server-side code
 * (API routes, server actions) for operations that require elevated privileges.
 */
export function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}
