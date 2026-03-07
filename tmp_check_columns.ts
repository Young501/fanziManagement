import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
async function run() {
    const { data, error } = await supabase.from('company_receivables').select('*').limit(1);
    if (error) {
        console.error('Error fetching company_receivables:', error);
    } else {
        const columns = Object.keys(data[0] || {});
        console.log('---START_COLUMNS---');
        columns.forEach(c => console.log(c));
        console.log('---END_COLUMNS---');
    }
}
run();
