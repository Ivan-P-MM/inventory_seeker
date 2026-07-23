import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/advertiser-inventory
 * Returns all unique advertiser names with their domain lists.
 */
export async function GET() {
    try {
        const supabase = createServerClient();

        // 1. Fetch advertiser inventory
        const { data: invData, error: invError } = await supabase
            .from('advertiser_inventory')
            .select('*')
            .order('advertiser', { ascending: true })
            .order('created_at', { ascending: true });

        if (invError) throw invError;

        // 2. Fetch domain_rating_repository categories
        const { data: ratingData, error: ratingError } = await supabase
            .from('domain_rating_repository')
            .select('root_domain, category');
            
        if (ratingError) throw ratingError;
        
        const categoryMap = {};
        for (const row of ratingData || []) {
            if (row.root_domain && row.category) {
                // category might be stored as array, handle array or string
                categoryMap[row.root_domain] = Array.isArray(row.category) ? row.category.join(' / ') : row.category;
            }
        }

        // Group by advertiser name
        const map = {};
        for (const row of invData || []) {
            if (!map[row.advertiser]) {
                map[row.advertiser] = { name: row.advertiser, inventory_items: [], inventory_item_dates: {}, inventory_item_categories: {}, oldestCreatedAt: row.created_at };
            }
            map[row.advertiser].inventory_items.push(row.inventory_item);
            map[row.advertiser].inventory_item_dates[row.inventory_item] = row.created_at;
            map[row.advertiser].inventory_item_categories[row.inventory_item] = categoryMap[row.inventory_item] || '';
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
 * Body: { name: string, inventory_items: string[] }
 */
export async function POST(request) {
    try {
        const { name, inventory_items } = await request.json();

        if (!name || !name.trim()) {
            return Response.json({ error: 'Advertiser name is required' }, { status: 400 });
        }

        const advertiserName = name.trim();
        const cleanDomains = (inventory_items || [])
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
            const rows = dedupedDomains.map(inventory_item => ({ advertiser: advertiserName, inventory_item }));
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
