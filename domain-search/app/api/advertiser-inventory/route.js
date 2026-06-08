import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/advertiser-inventory
 * Returns all unique advertiser names with their domain lists.
 */
export async function GET() {
    try {
        const supabase = createServerClient();

        const { data, error } = await supabase
            .from('advertiser_inventory')
            .select('*')
            .order('advertiser', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Group by advertiser name
        const map = {};
        for (const row of data || []) {
            if (!map[row.advertiser]) {
                map[row.advertiser] = { name: row.advertiser, domains: [], oldestCreatedAt: row.created_at };
            }
            map[row.advertiser].domains.push(row.domain);
        }

        return Response.json(Object.values(map));
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/advertiser-inventory
 * Upserts a full advertiser profile (name + whitelist of domains).
 * Replaces all existing domains for that advertiser.
 * Body: { name: string, domains: string[] }
 */
export async function POST(request) {
    try {
        const { name, domains } = await request.json();

        if (!name || !name.trim()) {
            return Response.json({ error: 'Advertiser name is required' }, { status: 400 });
        }

        const advertiserName = name.trim();
        const cleanDomains = (domains || [])
            .map(d => d.trim().toLowerCase())
            .filter(d => d.length > 0);

        const supabase = createServerClient();

        // Delete existing rows for this advertiser (full replace)
        const { error: delError } = await supabase
            .from('advertiser_inventory')
            .delete()
            .eq('advertiser', advertiserName);

        if (delError) throw delError;

        // Insert new rows (deduplicate exact matches)
        const seen = new Set();
        const dedupedDomains = [];
        for (const d of cleanDomains) {
            if (!seen.has(d)) {
                seen.add(d);
                dedupedDomains.push(d);
            }
        }

        if (dedupedDomains.length > 0) {
            const rows = dedupedDomains.map(domain => ({ advertiser: advertiserName, domain }));
            const { error: insertError } = await supabase
                .from('advertiser_inventory')
                .insert(rows);

            if (insertError) throw insertError;
        }

        return Response.json({ success: true, name: advertiserName, domainCount: dedupedDomains.length });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

/**
 * DELETE /api/advertiser-inventory
 * Deletes all rows for a given advertiser name.
 * Body: { name: string }
 */
export async function DELETE(request) {
    try {
        const { name } = await request.json();

        if (!name || !name.trim()) {
            return Response.json({ error: 'Advertiser name is required' }, { status: 400 });
        }

        const supabase = createServerClient();
        const { error } = await supabase
            .from('advertiser_inventory')
            .delete()
            .eq('advertiser', name.trim());

        if (error) throw error;

        return Response.json({ success: true });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

/**
 * PATCH /api/advertiser-inventory
 * Renames an advertiser (updates all rows with old name to new name).
 * Body: { oldName: string, newName: string }
 */
export async function PATCH(request) {
    try {
        const { oldName, newName } = await request.json();

        if (!oldName?.trim() || !newName?.trim()) {
            return Response.json({ error: 'Both oldName and newName are required' }, { status: 400 });
        }

        const supabase = createServerClient();
        const { error } = await supabase
            .from('advertiser_inventory')
            .update({ advertiser: newName.trim() })
            .eq('advertiser', oldName.trim());

        if (error) throw error;

        return Response.json({ success: true });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
