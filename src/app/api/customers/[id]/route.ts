import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Missing customer ID' }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Fetch customer basic info
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (customerError) {
            return NextResponse.json({ error: customerError.message }, { status: 500 });
        }

        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Fetch company profile (if exists)
        const { data: companyProfile } = await supabase
            .from('customer_company_profiles')
            .select('*')
            .eq('customer_id', id)
            .maybeSingle();

        // Fetch shareholders
        const { data: shareholders } = await supabase
            .from('customer_shareholders')
            .select('*')
            .eq('customer_id', id);

        // Backward-compatible aliases for detail pages
        let normalizedCompanyProfile = companyProfile
            ? {
                ...companyProfile,
                credit_code: companyProfile.credit_code ?? companyProfile.taxpayer_no ?? companyProfile.tax_number ?? customer.unified_social_credit_code ?? null,
                legal_representative: companyProfile.legal_representative ?? companyProfile.legal_person ?? null,
                establishment_date: companyProfile.establishment_date ?? companyProfile.registration_date ?? null,
                business_scope: companyProfile.business_scope ?? companyProfile.community ?? null
            }
            : (customer.unified_social_credit_code ? {
                customer_id: id,
                credit_code: customer.unified_social_credit_code,
                legal_representative: null,
                establishment_date: null,
                business_scope: null
            } : null);

        const normalizedShareholders = (shareholders || []).map((sh: any) => ({
            ...sh,
            name: sh.name ?? sh.shareholder_name ?? null
        }));

        return NextResponse.json({
            customer,
            companyProfile: normalizedCompanyProfile,
            shareholders: normalizedShareholders
        });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Missing customer ID' }, { status: 400 });
        }

        const body = await request.json();
        const { company_name, contact_person, contact_info, website_member, address, customer_status, source_info, service_manager } = body;

        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('customers')
            .update({
                company_name,
                contact_person,
                contact_info,
                website_member,
                address,
                customer_status,
                source_info,
                service_manager
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
    }
}

