import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/reevaluate-inventory/start-domains
 * Resets the evaluation status for specific domains.
 * Body: { domains: string[] }
 */
export async function POST(request) {
    try {
        const { domains } = await request.json();

        if (!Array.isArray(domains) || domains.length === 0) {
            return NextResponse.json(
                { error: 'A non-empty array of domains is required' },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // Check if items exist
        const { data: items, error: fetchError } = await supabase
            .from('advertiser_inventory')
            .select('id, inventory_item')
            .in('inventory_item', domains);

        if (fetchError) {
            console.error('Error fetching domain items:', fetchError);
            return NextResponse.json(
                { error: 'Failed to fetch domain items' },
                { status: 500 }
            );
        }

        if (!items || items.length === 0) {
            return NextResponse.json({
                success: true,
                total: 0,
                message: 'No items found for the given domains'
            });
        }

        // Reset the evaluation columns for all matching domains
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
            .in('inventory_item', domains);

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
        console.error('Reevaluate start-domains error:', err);
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}
