import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/check-blacklist — Step 4.3
 *
 * Accepts: { searchId }
 * - Fetches CERT Polska v2 + AnudeepND adservers blacklists in parallel
 * - Cross-references root_domain (and subdomain.root_domain) against both lists
 * - Marks matching rows as "Blacklisted"
 */
export async function POST(request) {
    try {
        const { searchId } = await request.json();

        if (!searchId) {
            return NextResponse.json(
                { error: 'searchId is required' },
                { status: 400 }
            );
        }

        // Fetch both blacklists in parallel
        const [certResponse, anudeepResponse] = await Promise.all([
            fetch('https://hole.cert.pl/domains/v2/domains.txt').catch(() => null),
            fetch('https://raw.githubusercontent.com/anudeepND/blacklist/master/adservers.txt').catch(() => null),
        ]);

        const blockedDomains = new Set();

        // Parse CERT Polska: one domain per line
        if (certResponse?.ok) {
            const certText = await certResponse.text();
            for (const line of certText.split('\n')) {
                const domain = line.trim().toLowerCase();
                if (domain && !domain.startsWith('#')) {
                    blockedDomains.add(domain);
                }
            }
        }

        // Parse AnudeepND: hosts format "0.0.0.0 domain"
        if (anudeepResponse?.ok) {
            const anudeepText = await anudeepResponse.text();
            for (const line of anudeepText.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 2 && parts[0] === '0.0.0.0') {
                    blockedDomains.add(parts[1].toLowerCase());
                }
            }
        }

        // 3. Fetch Local Blacklist from Supabase
        const supabase = createServerClient();
        const { data: localBlacklist } = await supabase
            .from('blacklist')
            .select('domain');

        if (localBlacklist) {
            localBlacklist.forEach(item => {
                blockedDomains.add(item.domain.toLowerCase().trim());
            });
        }

        console.log(`Loaded ${blockedDomains.size} total blocked domains (external + local)`);

        // Fetch all pending rows for this search
        const { data: rows, error: fetchError } = await supabase
            .from('web_current_results')
            .select('id, root_domain, subdomain')
            .eq('search_id', searchId)
            .eq('dv360_status', 'Pending verification');

        if (fetchError) {
            return NextResponse.json(
                { error: 'Failed to fetch results from database' },
                { status: 500 }
            );
        }

        // Find blacklisted rows
        const blacklistedIds = [];
        for (const row of rows || []) {
            const rootLower = row.root_domain.toLowerCase();
            const fullDomain = row.subdomain
                ? `${row.subdomain.toLowerCase()}.${rootLower}`
                : rootLower;

            if (blockedDomains.has(rootLower) || blockedDomains.has(fullDomain)) {
                blacklistedIds.push(row.id);
            }
        }

        // Batch update blacklisted rows
        let blacklistedCount = 0;
        if (blacklistedIds.length > 0) {
            const { error: updateError } = await supabase
                .from('web_current_results')
                .update({ dv360_status: 'Blacklisted' })
                .in('id', blacklistedIds);

            if (updateError) {
                console.error('Blacklist update error:', updateError);
            } else {
                blacklistedCount = blacklistedIds.length;
            }
        }

        return NextResponse.json({
            totalChecked: (rows || []).length,
            blacklistedCount,
            remainingPending: (rows || []).length - blacklistedCount,
        });
    } catch (err) {
        console.error('Blacklist check error:', err);
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}
