import { createServerClient } from '@/lib/supabase';

export async function POST(request) {
    try {
        const { domains } = await request.json();
        
        if (!Array.isArray(domains)) {
            return Response.json({ error: 'Expected an array of domains' }, { status: 400 });
        }

        const supabase = createServerClient();

        // Optional: We can simply clear all existing and insert new ones
        // or we could carefully sync them. Given the user wants a raw text edit,
        // replacing all is the safest way to ensure what they type is exactly what's saved.
        
        // 1. Delete all existing
        const { error: deleteError } = await supabase
            .from('blacklist')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to delete all

        if (deleteError) throw deleteError;

        // 2. Insert new list (deduplicate exact matches)
        if (domains.length > 0) {
            const seen = new Set();
            const rowsToInsert = [];
            for (const domain of domains) {
                const cleaned = domain.toLowerCase().trim();
                if (cleaned && !seen.has(cleaned)) {
                    seen.add(cleaned);
                    rowsToInsert.push({ domain: cleaned });
                }
            }

            if (rowsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('blacklist')
                    .insert(rowsToInsert);

                if (insertError) throw insertError;
            }
        }

        return Response.json({ success: true });
    } catch (err) {
        console.error('[blacklist/bulk]', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
