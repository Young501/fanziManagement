import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
async function run() {
    const { data, error } = await supabase.from('company_receivables').select('amount_paid_period, amount_payable_period, payment_due_date, status').limit(5);
    console.log(JSON.stringify(data, null, 2));
}
run();
