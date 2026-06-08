import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/advertisers/[id]/domains/bulk — Bulk sync domains for an advertiser
 * Body: { domains: string[] }
 * Replaces all existing domains with the provided list (same pattern as blacklist bulk).
 */
export async function POST(request, { params }) {
    try {
        const { id } = await params;
        const { domains } = await request.json();

        if (!Array.isArray(domains)) {
            return Response.json({ error: 'Expected an array of domains' }, { status: 400 });
        }

        const supabase = createServerClient();

        // 1. Delete all existing domains for this advertiser
        const { error: deleteError } = await supabase
            .from('advertiser_domains')
            .delete()
            .eq('advertiser_id', id);

        if (deleteError) throw deleteError;

        // 2. Insert the new list
        if (domains.length > 0) {
            const rowsToInsert = domains.map(domain => ({
                advertiser_id: id,
                domain: domain.toLowerCase().trim(),
            }));

            const { error: insertError } = await supabase
                .from('advertiser_domains')
                .insert(rowsToInsert);

            if (insertError) throw insertError;
        }

        return Response.json({ success: true, count: domains.length });
    } catch (err) {
        console.error('[advertisers/domains/bulk]', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
