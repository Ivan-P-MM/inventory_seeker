import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/reevaluate-inventory/start
 * Resets the evaluation status for all domains of a specific advertiser.
 * Body: { advertiserName: string }
 */
export async function POST(request) {
    try {
        const { advertiserName } = await request.json();

        if (!advertiserName || !advertiserName.trim()) {
            return NextResponse.json(
                { error: 'advertiserName is required' },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // Check if the advertiser exists and has items
        const { data: items, error: fetchError } = await supabase
            .from('advertiser_inventory')
            .select('id, inventory_item')
            .eq('advertiser', advertiserName.trim());

        if (fetchError) {
            console.error('Error fetching advertiser domains:', fetchError);
            return NextResponse.json(
                { error: 'Failed to fetch domains for advertiser' },
                { status: 500 }
            );
        }

        if (!items || items.length === 0) {
            return NextResponse.json({
                success: true,
                total: 0,
                message: 'No items found for this advertiser'
            });
        }

        // Reset the evaluation columns for all items of this advertiser
        const { error: updateError } = await supabase
            .from('advertiser_inventory')
            .update({
                eval_status: 'pending',
                domain_rating: null,
                ahrefs_rank: null,
                ads_txt_compliant: null,
                ads_txt_payload: null,
                rejection_reason: null,
                last_evaluated_at: null
            })
            .eq('advertiser', advertiserName.trim());

        if (updateError) {
            console.error('Error resetting evaluation status:', updateError);
            return NextResponse.json(
                { error: 'Failed to reset evaluation status' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            total: items.length,
            message: `Successfully queued ${items.length} items for evaluation`
        });
    } catch (err) {
        console.error('Reevaluate start error:', err);
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}
