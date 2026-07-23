import { createServerClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createServerClient();
        const { data, error } = await supabase
            .from('blacklist')
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
        const { inventory_item, reason } = await request.json();
        if (!inventory_item) {
            return Response.json({ error: 'Inventory item is required' }, { status: 400 });
        }

        const supabase = createServerClient();
        const { data, error } = await supabase
            .from('blacklist')
            .upsert({ inventory_item: inventory_item.toLowerCase().trim(), reason })
            .select()
            .single();

        if (error) throw error;

        return Response.json(data);
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { id } = await request.json();
        if (!id) {
            return Response.json({ error: 'ID is required' }, { status: 400 });
        }

        const supabase = createServerClient();
        const { error } = await supabase
            .from('blacklist')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return Response.json({ success: true });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
