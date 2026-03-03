import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL or Anon Key is missing in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('Testing connection to Supabase...');
    console.log('URL:', supabaseUrl);
    try {
        // 尝试获取任何表的数据（即使表不存在或没权限，也能说明网络连通性）
        // 但更简单的连通测试是调用 auth
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            console.error('❌ Connection failed:', error.message);
        } else {
            console.log('✅ Connection successful! Session state retrieved.');
            // 我们可以尝试查一个数据库信息
            const { error: dbError } = await supabase.from('_test_connection_').select('*').limit(1);
            if (dbError) {
                // 表不存在是正常的，只要不是网络或凭据错误即可
                if (dbError.code === '42P01' || dbError.message.includes('does not exist')) {
                    console.log('✅ Database is reachable (relation missing, which is expected).');
                } else {
                    console.log('ℹ️ Database query result (might be RLS or missing table):', dbError.message);
                }
            }
        }
    } catch (err: any) {
        console.error('❌ Caught Exception:', err.message);
    }
}

testConnection();
