import { createServerClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createServerClient();
        const { data, error } = await supabase
            .from('inventory_categories')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return Response.json(data);
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { categories } = await request.json();
        
        if (!Array.isArray(categories)) {
            return Response.json({ error: 'Expected an array of categories' }, { status: 400 });
        }

        const supabase = createServerClient();

        // 1. Delete all existing
        const { error: deleteError } = await supabase
            .from('inventory_categories')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to delete all

        if (deleteError) throw deleteError;

        // 2. Insert new list (deduplicate exact matches)
        if (categories.length > 0) {
            const seen = new Set();
            const rowsToInsert = [];
            for (const item of categories) {
                const cleaned = item.trim();
                if (cleaned && !seen.has(cleaned)) {
                    seen.add(cleaned);
                    rowsToInsert.push({ category_name: cleaned });
                }
            }

            if (rowsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('inventory_categories')
                    .insert(rowsToInsert);

                if (insertError) throw insertError;
            }
        }

        return Response.json({ success: true });
    } catch (err) {
        console.error('[categories/bulk]', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
