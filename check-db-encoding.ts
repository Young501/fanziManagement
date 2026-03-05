import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
async function run() {
    const { data, error } = await supabase.from('company_receivables').select('id, note, receipt_note').not('note', 'is', null).limit(1);
    if (data && data.length > 0) {
        console.log("Raw Note String:", data[0].note);
        console.log("Hex encoding of Note:", Buffer.from(data[0].note || '', 'utf-8').toString('hex'));
    }
}
run();
