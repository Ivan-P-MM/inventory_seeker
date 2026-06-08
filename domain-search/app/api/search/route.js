import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { parseUrl } from '@/lib/parseUrl';

const EXCLUDED_DOMAINS = [
    'youtube.com',
    'youtu.be',
    'reddit.com',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'linkedin.com',
    'pinterest.com',
    'tiktok.com',
];

/**
 * POST /api/search — Steps 4.1 + 4.2
 */
export async function POST(request) {
    try {
        const { keyword, language = 'en', sessionId, advertiserName } = await request.json();

        if (!keyword || !sessionId) {
            return NextResponse.json(
                { error: 'keyword and sessionId are required' },
                { status: 400 }
            );
        }

        const apiKey = process.env.SERPAPI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'SerpAPI credentials not configured' },
                { status: 500 }
            );
        }

        const supabase = createServerClient();

        // 1. Get existing display_paths for this session to ensure global uniqueness
        // Also fetch persistent blacklist and advertiser domains
        const fetchPromises = [
            supabase.from('web_current_results').select('display_path').eq('session_id', sessionId),
            supabase.from('blacklist').select('domain'),
        ];

        // If an advertiser is selected, also fetch their existing domains for exclusion
        if (advertiserName) {
            fetchPromises.push(
                supabase.from('advertiser_inventory').select('domain').eq('advertiser', advertiserName)
            );
        }

        const results = await Promise.all(fetchPromises);
        const [{ data: existingData }, { data: blacklistData }] = results;
        const advertiserDomainData = advertiserName ? results[2]?.data : null;
        
        const seenInSession = new Set(existingData?.map(r => r.display_path) || []);
        const persistentBlacklist = new Set(blacklistData?.map(b => b.domain.toLowerCase()) || []);
        const advertiserDomains = new Set(advertiserDomainData?.map(d => d.domain.toLowerCase()) || []);

        const searchId = crypto.randomUUID();
        const allResults = [];
        const seenInBatch = new Set();

        // Paginate: start=0, 10, 20, ..., 90 (max 100 results)
        for (let start = 0; start <= 90; start += 10) {
            const params = new URLSearchParams({
                api_key: apiKey,
                engine: 'google',
                q: keyword,
                hl: language,
                start: start.toString(),
                num: '10',
            });

            const response = await fetch(`https://serpapi.com/search.json?${params}`);

            if (!response.ok) {
                const body = await response.text();
                console.error(`SerpAPI error (start=${start}):`, body);
                break;
            }

            const data = await response.json();
            const items = data.organic_results || [];

            for (const item of items) {
                const parsed = parseUrl(item.link);
                if (!parsed) continue;

                // 2. Exclude specific domains
                const rootLower = parsed.root_domain.toLowerCase();
                const fullDomain = parsed.subdomain ? `${parsed.subdomain.toLowerCase()}.${rootLower}` : rootLower;

                const isExcluded = 
                    EXCLUDED_DOMAINS.some(d => rootLower === d || parsed.display_path.startsWith(d + '/')) ||
                    persistentBlacklist.has(rootLower) || 
                    persistentBlacklist.has(fullDomain) ||
                    advertiserDomains.has(rootLower) ||
                    advertiserDomains.has(fullDomain);

                if (isExcluded) continue;

                // 3. Uniqueness based on display_path
                const dPath = parsed.display_path;
                if (!seenInBatch.has(dPath) && !seenInSession.has(dPath)) {
                    seenInBatch.add(dPath);
                    allResults.push({
                        search_id: searchId,
                        session_id: sessionId,
                        keyword,
                        title: item.title,
                        full_url: parsed.full_url,
                        root_domain: parsed.root_domain,
                        subdomain: parsed.subdomain,
                        path: parsed.path,
                        display_path: dPath,
                        dv360_status: 'Pending verification',
                    });
                }
            }

            if (items.length < 10) break;
        }

        if (allResults.length === 0) {
            return NextResponse.json({ searchId, count: 0 });
        }

        // 4. Bulk insert into Supabase
        let { error } = await supabase
            .from('web_current_results')
            .insert(allResults);

        if (error && error.message.includes('display_path')) {
            console.warn('display_path column missing, falling back to basic insert...');
            const fallbackResults = allResults.map(({ display_path, ...rest }) => rest);
            const { error: fallbackError } = await supabase
                .from('web_current_results')
                .insert(fallbackResults);
            error = fallbackError;
        }

        if (error) {
            console.error('Supabase insert error:', error);
            return NextResponse.json(
                { error: 'Failed to save results to database' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            searchId,
            count: allResults.length,
            keyword,
        });
    } catch (err) {
        console.error('Search API error:', err);
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}
