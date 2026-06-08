import { createServerClient } from '@/lib/supabase';

const AHREFS_API_KEY = process.env.AHREFS_API_KEY;
const AHREFS_DR_URL = 'https://api.ahrefs.com/v3/site-explorer/domain-rating';

/**
 * Fetch Domain Rating for a single domain from Ahrefs.
 * Returns { domain_rating, ahrefs_rank } or throws on error.
 */
async function fetchDR(domain) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const url = `${AHREFS_DR_URL}?target=${encodeURIComponent(domain)}&date=${today}`;

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${AHREFS_API_KEY}`,
            Accept: 'application/json',
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ahrefs API error (${res.status}): ${text}`);
    }

    const json = await res.json();
    // Ahrefs returns { domain_rating: { domain_rating, ahrefs_rank } }
    const dr = json?.domain_rating?.domain_rating ?? null;
    const ar = json?.domain_rating?.ahrefs_rank ?? null;
    return { domain_rating: dr, ahrefs_rank: ar };
}

/**
 * POST /api/domain-rating
 * Body: { sessionId } — fetches DR for all unique root_domains in the session
 *   OR
 * Body: { domain } — fetches DR for a single domain (used for on-demand refresh)
 */
export async function POST(request) {
    try {
        if (!AHREFS_API_KEY) {
            return Response.json({ error: 'AHREFS_API_KEY not configured' }, { status: 500 });
        }

        const body = await request.json();
        const supabase = createServerClient();

        // ── Single domain mode ──────────────────────────────────────────────
        if (body.domain) {
            const { domain_rating, ahrefs_rank } = await fetchDR(body.domain);
            return Response.json({ domain: body.domain, domain_rating, ahrefs_rank });
        }

        // ── Session mode ────────────────────────────────────────────────────
        const { sessionId, minimalDr, keyword, topic } = body;
        if (!sessionId) {
            return Response.json({ error: 'sessionId or domain is required' }, { status: 400 });
        }

        const targetDr = minimalDr ? parseInt(minimalDr, 10) : 0;

        // Fetch all rows in this session that are 'Approved' (passed Ads.txt) but don't yet have a DR value
        const { data: rows, error: fetchError } = await supabase
            .from('web_current_results')
            .select('*')
            .eq('session_id', sessionId)
            .eq('dv360_status', 'Approved')
            .is('domain_rating', null);

        if (fetchError) throw fetchError;
        if (!rows || rows.length === 0) {
            return Response.json({ updated: 0, message: 'All domains already have DR data' });
        }

        // Deduplicate root_domains so we don't waste API credits
        const uniqueDomains = [...new Set(rows.map(r => r.root_domain))];
        const drCache = {};

        for (const domain of uniqueDomains) {
            try {
                const { domain_rating, ahrefs_rank } = await fetchDR(domain);
                drCache[domain] = { domain_rating, ahrefs_rank };
            } catch (e) {
                console.error(`DR fetch failed for ${domain}:`, e.message);
                drCache[domain] = { domain_rating: null, ahrefs_rank: null };
            }
        }

        // Batch-update all rows with the fetched DR values and apply minimal DR check
        let updated = 0;
        const newlyApprovedToSave = [];

        for (const row of rows) {
            const { domain_rating, ahrefs_rank } = drCache[row.root_domain] || {};
            
            let status = 'Approved';
            let reason = row.rejection_reason;

            if (domain_rating !== null && domain_rating < targetDr) {
                status = 'Rejected';
                reason = `Low Domain Rating (${domain_rating} < ${targetDr})`;
            }

            const { error: updateError } = await supabase
                .from('web_current_results')
                .update({ 
                    domain_rating, 
                    ahrefs_rank,
                    dv360_status: status,
                    rejection_reason: reason
                })
                .eq('id', row.id);

            if (!updateError) {
                updated++;
                // If it remained Approved, it means it passed both Ads.txt and DR check
                if (status === 'Approved' && domain_rating !== null) {
                    newlyApprovedToSave.push({
                        root_domain: row.root_domain,
                        subdomain: row.subdomain,
                        path: row.path,
                        ads_txt_payload: row.ads_txt_payload,
                        domain_rating: domain_rating,
                        ahrefs_rank: ahrefs_rank,
                        result_description: [keyword, topic].filter(Boolean)
                    });
                }
            }
        }

        // Insert newly approved domains into the global domain_rating_repository table
        if (newlyApprovedToSave.length > 0) {
            const { error: insertError } = await supabase
                .from('domain_rating_repository')
                .upsert(newlyApprovedToSave, { onConflict: 'root_domain' }) // Upsert to avoid duplicates if root_domain is unique
                .select();
                
            if (insertError) {
                console.error('[domain-rating] Failed to save to domain_rating_repository:', insertError);
            }
        }

        return Response.json({ updated, domains: Object.keys(drCache).length });
    } catch (err) {
        console.error('[domain-rating] error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
