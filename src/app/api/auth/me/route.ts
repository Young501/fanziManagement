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

        if (profileError) {
            // Give back basic info if profile table access fails
            return NextResponse.json({
                user: { id: user.id, email: user.email, role: 'user' }
            });
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                role: profile?.role || 'user',
                ...profile
            }
        });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
    }
}
