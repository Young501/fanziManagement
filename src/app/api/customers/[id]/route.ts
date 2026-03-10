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

        // Return the full company profile without restrictive mapping so the frontend can access all fields
        const normalizedCompanyProfile = companyProfile || null;

        const normalizedShareholders = shareholders || [];

        // Fetch contracts
        const { data: contracts } = await supabase
            .from('customer_contracts')
            .select('*')
            .eq('customer_id', id)
            .order('created_at', { ascending: false });

        return NextResponse.json({
            customer,
            companyProfile: normalizedCompanyProfile,
            shareholders: normalizedShareholders,
            contracts: contracts || []
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
        const {
            company_name,
            contact_person,
            contact_info,
            website_member,
            address,
            customer_status,
            source_info,
            service_manager,
            companyProfile,
            shareholder,
            deleteShareholderId
        } = body;

        const supabase = createAdminClient();

        // 1. Delete Shareholder
        if (deleteShareholderId) {
            const { error: deleteError } = await supabase
                .from('customer_shareholders')
                .delete()
                .eq('id', deleteShareholderId);

            if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
            return NextResponse.json({ success: true });
        }

        // 2. Upsert Shareholder
        if (shareholder) {
            if (shareholder.id) {
                // Update existing
                const { error: updateShError } = await supabase
                    .from('customer_shareholders')
                    .update({
                        name: shareholder.name,
                        share_ratio: shareholder.share_ratio || null,
                        contact_number: shareholder.contact_number || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', shareholder.id);
                if (updateShError) return NextResponse.json({ error: updateShError.message }, { status: 500 });
            } else {
                // Insert new
                const { error: insertShError } = await supabase
                    .from('customer_shareholders')
                    .insert({
                        customer_id: id,
                        name: shareholder.name,
                        share_ratio: shareholder.share_ratio || null,
                        contact_number: shareholder.contact_number || null
                    });
                if (insertShError) return NextResponse.json({ error: insertShError.message }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        // 3. Upsert Company Profile
        if (companyProfile) {
            // Because customer_id is the foreign key and likely unique (1:1), 
            // we first check if the profile exists to decide update vs insert
            const { data: existingProfile } = await supabase
                .from('customer_company_profiles')
                .select('id')
                .eq('customer_id', id)
                .maybeSingle();

            const profileData = { ...companyProfile };
            delete profileData.id; // ensure we don't accidentally insert/update ID if not meant to

            if (existingProfile) {
                const { error: updateProfileError } = await supabase
                    .from('customer_company_profiles')
                    .update(profileData)
                    .eq('customer_id', id);
                if (updateProfileError) return NextResponse.json({ error: updateProfileError.message }, { status: 500 });
            } else {
                profileData.customer_id = id;
                const { error: insertProfileError } = await supabase
                    .from('customer_company_profiles')
                    .insert(profileData);
                if (insertProfileError) return NextResponse.json({ error: insertProfileError.message }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        // 4. Update basic customer info (Fallback if no specific nested objects sent)
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

