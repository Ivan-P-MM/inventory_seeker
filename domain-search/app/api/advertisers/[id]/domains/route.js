import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/advertisers/[id]/domains — List all domains for an advertiser
 */
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const supabase = createServerClient();

        const { data, error } = await supabase
            .from('advertiser_domains')
            .select('*')
            .eq('advertiser_id', id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return Response.json(data);
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/advertisers/[id]/domains — Add a single domain
 * Body: { domain: string }
 */
export async function POST(request, { params }) {
    try {
        const { id } = await params;
        const { domain } = await request.json();

        if (!domain || !domain.trim()) {
            return Response.json({ error: 'Domain is required' }, { status: 400 });
        }

        const supabase = createServerClient();
        const { data, error } = await supabase
            .from('advertiser_domains')
            .upsert({ advertiser_id: id, domain: domain.toLowerCase().trim() })
            .select()
            .single();

        if (error) throw error;

        return Response.json(data);
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

/**
 * DELETE /api/advertisers/[id]/domains — Remove a domain entry
 * Body: { domainId: uuid }
 */
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        const { domainId } = await request.json();

        if (!domainId) {
            return Response.json({ error: 'Domain entry ID is required' }, { status: 400 });
        }

        const supabase = createServerClient();
        const { error } = await supabase
            .from('advertiser_domains')
            .delete()
            .eq('id', domainId)
            .eq('advertiser_id', id);

        if (error) throw error;

        return Response.json({ success: true });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
