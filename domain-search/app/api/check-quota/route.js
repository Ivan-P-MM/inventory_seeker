import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/check-quota — Step 4.6
 *
 * Accepts: { sessionId, requiredCount }
 * - Counts rows where session_id matches & dv360_status = "Approved"
 * - Returns { validatedCount, requiredCount, isMet }
 */
export async function POST(request) {
    try {
        const { sessionId, requiredCount } = await request.json();

        if (!sessionId || requiredCount === undefined) {
            return NextResponse.json(
                { error: 'sessionId and requiredCount are required' },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        const { count, error } = await supabase
            .from('web_current_results')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', sessionId)
            .eq('dv360_status', 'Approved');

        if (error) {
            return NextResponse.json(
                { error: 'Failed to count validated results' },
                { status: 500 }
            );
        }

        const validatedCount = count || 0;

        return NextResponse.json({
            validatedCount,
            requiredCount: parseInt(requiredCount, 10),
            isMet: validatedCount >= parseInt(requiredCount, 10),
        });
    } catch (err) {
        console.error('Check quota error:', err);
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}
