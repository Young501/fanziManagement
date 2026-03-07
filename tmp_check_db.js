const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkColumns() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
        .from('customer_company_profiles')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Sample row columns:', Object.keys(data[0]));
        data.forEach((row, i) => {
            console.log(`Row ${i} taxpayer_no:`, row.taxpayer_no);
            console.log(`Row ${i} credit_code:`, row.credit_code);
            console.log(`Row ${i} tax_number:`, row.tax_number);
        });
    } else {
        console.log('No data found in customer_company_profiles');
    }
}

checkColumns();
