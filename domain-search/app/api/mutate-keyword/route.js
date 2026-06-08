import { NextResponse } from 'next/server';
import { mutateKeyword } from '@/lib/gemini';

/**
 * POST /api/mutate-keyword — Step 4.7
 *
 * Accepts: { keyword, previousKeywords }
 * - Calls Gemini API to generate a semantically related keyword variant
 * - Returns { newKeyword }
 */
export async function POST(request) {
    try {
        const { keyword, previousKeywords = [] } = await request.json();

        if (!keyword) {
            return NextResponse.json(
                { error: 'keyword is required' },
                { status: 400 }
            );
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'Gemini API key not configured' },
                { status: 500 }
            );
        }

        const newKeyword = await mutateKeyword(keyword, previousKeywords);

        return NextResponse.json({ newKeyword });
    } catch (err) {
        console.error('Mutate keyword error:', err);
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}
