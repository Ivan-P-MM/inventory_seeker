import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/advertisers — List all advertisers with domain counts
 */
export async function GET() {
    try {
        const supabase = createServerClient();

        // Fetch advertisers
        const { data: advertisers, error } = await supabase
            .from('advertisers')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Fetch domain counts per advertiser
        const { data: domainCounts, error: countError } = await supabase
            .from('advertiser_domains')
            .select('advertiser_id');

        if (countError) throw countError;

        // Build count map
        const countMap = {};
        (domainCounts || []).forEach(row => {
            countMap[row.advertiser_id] = (countMap[row.advertiser_id] || 0) + 1;
        });

        const result = (advertisers || []).map(a => ({
            ...a,
            domain_count: countMap[a.id] || 0,
        }));

        return Response.json(result);
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/advertisers — Create a new advertiser
 * Body: { name: string }
 */
export async function POST(request) {
    try {
        const { name } = await request.json();
        if (!name || !name.trim()) {
            return Response.json({ error: 'Advertiser name is required' }, { status: 400 });
        }

        const supabase = createServerClient();
        const { data, error } = await supabase
            .from('advertisers')
            .insert({ name: name.trim() })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return Response.json({ error: 'An advertiser with this name already exists' }, { status: 409 });
            }
            throw error;
        }

        return Response.json(data);
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

/**
 * DELETE /api/advertisers — Delete an advertiser (cascades to domains)
 * Body: { id: uuid }
 */
export async function DELETE(request) {
    try {
        const { id } = await request.json();
        if (!id) {
            return Response.json({ error: 'Advertiser ID is required' }, { status: 400 });
        }

        const supabase = createServerClient();
        const { error } = await supabase
            .from('advertisers')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return Response.json({ success: true });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
