const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verifyMapping() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
        .from('customer_company_profiles')
        .select('*')
        .not('taxpayer_no', 'is', null)
        .limit(1);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    if (data && data.length > 0) {
        const profile = data[0];
        console.log('Original Profile:', profile);

        // Emulate the updated API logic:
        // credit_code: companyProfile.credit_code ?? companyProfile.taxpayer_no ?? companyProfile.tax_number ?? null
        const normalizedCreditCode = profile.credit_code ?? profile.taxpayer_no ?? profile.tax_number ?? null;
        console.log('Normalized Credit Code:', normalizedCreditCode);

        if (normalizedCreditCode === profile.taxpayer_no || (profile.credit_code && normalizedCreditCode === profile.credit_code)) {
            console.log('VERIFICATION_SUCCESS: mapping holds');
        } else {
            console.log('VERIFICATION_FAILURE: mapping failed');
        }
    } else {
        console.log('No data with taxpayer_no found for verification');
    }
}

verifyMapping();
