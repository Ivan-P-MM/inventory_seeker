import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { parseAdsTxt } from '@/lib/parseAdsTxt';
import { gotScraping } from 'got-scraping';

/**
 * POST /api/verify-ads-txt — Steps 4.4 + 4.5
 *
 * Accepts: { sessionId }
 * - Fetches a batch of up to 10 rows with "Pending verification" status
 * - For each: GET ads.txt via ScraperAPI proxy
 * - Parses per IAB spec: checks for google.com + DIRECT/RESELLER
 * - Updates status to Approved or Rejected
 */
export async function POST(request) {
    try {
        const { sessionId } = await request.json();

        if (!sessionId) {
            return NextResponse.json(
                { error: 'sessionId is required' },
                { status: 400 }
            );
        }

        // (No longer using ScraperAPI if got-scraping provides the WAF bypass)
        // const scraperApiKey = process.env.SCRAPER_API_KEY;

        const supabase = createServerClient();

        // Fetch batch of pending rows (up to 10)
        const { data: rows, error: fetchError } = await supabase
            .from('web_current_results')
            .select('id, root_domain')
            .eq('session_id', sessionId)
            .eq('dv360_status', 'Pending verification')
            .limit(3);

        if (fetchError) {
            return NextResponse.json(
                { error: 'Failed to fetch pending results' },
                { status: 500 }
            );
        }

        if (!rows || rows.length === 0) {
            return NextResponse.json({ processed: 0, remaining: 0 });
        }

        // Deduplicate by root_domain to avoid redundant fetches
        const domainMap = new Map();
        for (const row of rows) {
            if (!domainMap.has(row.root_domain)) {
                domainMap.set(row.root_domain, []);
            }
            domainMap.get(row.root_domain).push(row.id);
        }

        const results = [];

        // Process each unique domain
        for (const [domain, ids] of domainMap) {
            let status = 'Rejected';
            let reason = 'Unknown error';
            let payload = null;



            try {
                const adsTxtUrl = `https://${domain}/ads.txt`;

                const response = await gotScraping({
                    url: adsTxtUrl,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                        'Accept': 'text/plain,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5'
                    },
                    timeout: { request: 2000 }, // 2s timeout per domain
                    throwHttpErrors: false,     // don't throw on 404
                });

                if (response.statusCode >= 200 && response.statusCode < 300) {
                    const content = response.body;
                    
                    const parsed = parseAdsTxt(content);
                    const hasDV360 = parsed.entries.some(e => e.domain === 'google.com' && (e.relationship === 'DIRECT' || e.relationship === 'RESELLER'));

                    if (hasDV360) {
                        status = 'Approved';
                        reason = null;
                        payload = parsed.entries.map(e => `${e.domain}, ${e.publisherId}, ${e.relationship}${e.certId ? `, ${e.certId}` : ''}`).join('\n');
                    } else {
                        reason = 'No Google DV360 entry found in ads.txt';
                    }
                } else if (response.statusCode === 404) {
                    reason = 'ads.txt file not found (404)';
                } else {
                    reason = `HTTP Error ${response.statusCode} when fetching ads.txt`;
                }
            } catch (err) {
                console.error(`ads.txt fetch error for ${domain}:`, err.message);
                if (err.name === 'TimeoutError' || err.code === 'ETIMEDOUT') {
                    reason = 'Timeout (site took too long to respond)';
                } else {
                    reason = `Network error: ${err.message}`;
                }
            }

            // Update all rows for this domain
            const updateData = { dv360_status: status, rejection_reason: reason };
            if (payload) {
                updateData.ads_txt_payload = payload;
            }

            const { error: updateError } = await supabase
                .from('web_current_results')
                .update(updateData)
                .in('id', ids);

            if (updateError) {
                console.error(`Update error for ${domain}:`, updateError);
            }

            results.push({ domain, status, reason, rowCount: ids.length });
        }

        // Count remaining pending
        const { count: remaining } = await supabase
            .from('web_current_results')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', sessionId)
            .eq('dv360_status', 'Pending verification');

        return NextResponse.json({
            processed: rows.length,
            remaining: remaining || 0,
            results,
        });
    } catch (err) {
        console.error('Verify ads.txt error:', err);
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}
