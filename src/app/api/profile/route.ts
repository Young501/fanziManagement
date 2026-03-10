import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        }

        return NextResponse.json({ data: profile || { id: user.id, email: user.email } });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
    }
}
