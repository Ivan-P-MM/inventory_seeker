import { createServerClient } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(request) {
    try {
        const { keyword, topic, language, sessionId, advertiserName } = await request.json();

        if (!keyword || !sessionId) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabase = createServerClient();

        // Build array of terms to search for in result_description
        const searchTerms = [keyword];
        if (topic) {
            searchTerms.push(topic);
        }

        // 1. Fetch blacklist and advertiser domains
        const fetchPromises = [
            supabase.from('blacklist').select('domain'),
        ];
        if (advertiserName) {
            fetchPromises.push(
                supabase.from('advertiser_inventory').select('domain').eq('advertiser', advertiserName)
            );
        }
        const fetchResults = await Promise.all(fetchPromises);
        const blacklistedDomains = new Set(fetchResults[0]?.data?.map(b => b.domain.toLowerCase()) || []);
        const advertiserDomains = new Set(
            advertiserName ? (fetchResults[1]?.data?.map(d => d.domain.toLowerCase()) || []) : []
        );

        // 2. Query domain_rating_repository
        const { data: approvedData, error: searchError } = await supabase
            .from('domain_rating_repository')
            .select('*')
            .overlaps('result_description', searchTerms);

        if (searchError) {
            throw searchError;
        }

        // 3. Filter out blacklisted and advertiser-owned domains
        const filteredData = (approvedData || []).filter(row => {
            const rootLower = row.root_domain.toLowerCase();
            const fullDomain = row.subdomain ? `${row.subdomain.toLowerCase()}.${rootLower}` : rootLower;
            return !blacklistedDomains.has(rootLower) && !blacklistedDomains.has(fullDomain) &&
                   !advertiserDomains.has(rootLower) && !advertiserDomains.has(fullDomain);
        });

        if (filteredData.length === 0) {
            return Response.json({ count: 0, message: 'No internal results found (or all filtered by blacklist)' });
        }

        // 4. Insert these into the current session's web_current_results
        const searchId = crypto.randomUUID();
        const rowsToInsert = filteredData.map(row => ({
            search_id: searchId,
            session_id: sessionId,
            keyword: keyword,
            full_url: `https://${row.root_domain}${row.path || ''}`, // Reconstruct a basic URL
            root_domain: row.root_domain,
            subdomain: row.subdomain,
            path: row.path,
            display_path: `${row.subdomain || row.root_domain}${row.path || ''}`,
            title: `Approved: ${row.root_domain}`, // We don't store title in domain_rating_repository right now
            dv360_status: 'Approved',
            rejection_reason: 'Pre-approved internal result',
            ads_txt_payload: row.ads_txt_payload,
            domain_rating: row.domain_rating,
            // Ahrefs rank isn't in web_current_results currently, but DR is.
        }));

        const { error: insertError } = await supabase
            .from('web_current_results')
            .insert(rowsToInsert);

        if (insertError) {
            throw insertError;
        }

        return Response.json({ 
            count: rowsToInsert.length, 
            searchId,
            message: `Found ${rowsToInsert.length} internal results` 
        });

    } catch (err) {
        console.error('[search-internal] error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
