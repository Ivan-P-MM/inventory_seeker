import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { parseAdsTxt } from '@/lib/parseAdsTxt';
import { gotScraping } from 'got-scraping';

const AHREFS_DR_URL = 'https://api.ahrefs.com/v3/public/domain-rating-free';

/**
 * Fetch Domain Rating for a single domain from Ahrefs.
 * Returns { domain_rating, ahrefs_rank } or throws on error.
 */
async function fetchDR(domain) {

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const url = `${AHREFS_DR_URL}?target=${encodeURIComponent(domain)}&date=${today}`;

    const res = await fetch(url, {
        headers: {
            Accept: 'application/json',
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ahrefs API error (${res.status}): ${text}`);
    }

    const json = await res.json();
    const dr = json?.domain_rating?.domain_rating ?? null;
    const ar = json?.domain_rating?.ahrefs_rank ?? null;
    return { domain_rating: dr, ahrefs_rank: ar };
}

/**
 * POST /api/reevaluate-inventory/process
 * Processes up to 3 pending domains for a given advertiser.
 * Body: { advertiserName: string, minimalDr: number }
 */
export async function POST(request) {
    try {
        const { advertiserName, minimalDr } = await request.json();

        if (!advertiserName || !advertiserName.trim()) {
            return NextResponse.json(
                { error: 'advertiserName is required' },
                { status: 400 }
            );
        }

        const targetDr = minimalDr ? parseInt(minimalDr, 10) : 0;
        const supabase = createServerClient();

        // 1. Fetch next batch of pending rows (up to 3)
        const { data: rows, error: fetchError } = await supabase
            .from('advertiser_inventory')
            .select('*')
            .eq('advertiser', advertiserName.trim())
            .eq('eval_status', 'pending')
            .limit(3);

        if (fetchError) {
            console.error('Error fetching pending rows:', fetchError);
            return NextResponse.json(
                { error: 'Failed to fetch pending rows' },
                { status: 500 }
            );
        }

        if (!rows || rows.length === 0) {
            return NextResponse.json({
                processed: 0,
                remaining: 0,
                results: []
            });
        }

        const processedResults = [];

        // 2. Process each item in the batch
        for (const row of rows) {
            const domain = row.inventory_item;
            let adsTxtCompliant = false;
            let adsTxtPayload = null;
            let rejectionReason = null;
            let domainRating = null;
            let ahrefsRank = null;
            let evalStatus = 'rejected';

            // --- Phase A: Ads.txt Fetch & Parse ---
            try {
                const adsTxtUrl = `https://${domain}/ads.txt`;
                const response = await gotScraping({
                    url: adsTxtUrl,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                        'Accept': 'text/plain,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5'
                    },
                    timeout: { request: 2000 }, // 2s timeout
                    throwHttpErrors: false,
                });

                if (response.statusCode >= 200 && response.statusCode < 300) {
                    const content = response.body;
                    const parsed = parseAdsTxt(content);
                    const hasDV360 = parsed.entries.some(
                        e => e.domain === 'google.com' && 
                        (e.relationship === 'DIRECT' || e.relationship === 'RESELLER')
                    );

                    if (hasDV360) {
                        adsTxtCompliant = true;
                        adsTxtPayload = parsed.entries
                            .map(e => `${e.domain}, ${e.publisherId}, ${e.relationship}${e.certId ? `, ${e.certId}` : ''}`)
                            .join('\n');
                    } else {
                        rejectionReason = 'No Google DV360 entry found in ads.txt';
                    }
                } else if (response.statusCode === 404) {
                    rejectionReason = 'ads.txt file not found (404)';
                } else {
                    rejectionReason = `HTTP Error ${response.statusCode} when fetching ads.txt`;
                }
            } catch (err) {
                console.error(`ads.txt fetch error for ${domain}:`, err.message);
                if (err.name === 'TimeoutError' || err.code === 'ETIMEDOUT') {
                    rejectionReason = 'Timeout (site took too long to respond)';
                } else {
                    rejectionReason = `Network error: ${err.message}`;
                }
            }

            // --- Phase B: Domain Rating Fetch (only if Ads.txt passed) ---
            if (adsTxtCompliant) {
                try {
                    const drInfo = await fetchDR(domain);
                    domainRating = drInfo.domain_rating;
                    ahrefsRank = drInfo.ahrefs_rank;

                    if (domainRating === null) {
                        rejectionReason = 'Failed to fetch Domain Rating data';
                    } else if (domainRating < targetDr) {
                        rejectionReason = `Low Domain Rating (${domainRating} < ${targetDr})`;
                    } else {
                        // Passed both Ads.txt and DR checks!
                        evalStatus = 'approved';
                    }
                } catch (err) {
                    console.error(`DR fetch error for ${domain}:`, err.message);
                    rejectionReason = `DR fetch failed: ${err.message}`;
                }
            }

            // --- Phase C: Update Database Row ---
            const updateData = {
                eval_status: evalStatus,
                domain_rating: domainRating,
                ahrefs_rank: ahrefsRank,
                ads_txt_compliant: adsTxtCompliant,
                ads_txt_payload: adsTxtPayload,
                rejection_reason: rejectionReason,
                last_evaluated_at: new Date().toISOString()
            };

            const { error: updateError } = await supabase
                .from('advertiser_inventory')
                .update(updateData)
                .eq('id', row.id);

            if (updateError) {
                console.error(`Update error for domain ${domain}:`, updateError);
            }

            processedResults.push({
                domain,
                status: evalStatus,
                domainRating,
                adsTxtCompliant,
                rejectionReason
            });
        }

        // 3. Count remaining pending domains for this advertiser
        const { count: remainingCount, error: countError } = await supabase
            .from('advertiser_inventory')
            .select('id', { count: 'exact', head: true })
            .eq('advertiser', advertiserName.trim())
            .eq('eval_status', 'pending');

        if (countError) {
            console.error('Error counting remaining pending rows:', countError);
        }

        return NextResponse.json({
            processed: rows.length,
            remaining: remainingCount || 0,
            results: processedResults
        });
    } catch (err) {
        console.error('Reevaluate process error:', err);
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}
