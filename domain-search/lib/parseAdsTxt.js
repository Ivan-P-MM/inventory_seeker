/**
 * Parse an ads.txt file content according to the IAB specification.
 *
 * Each data line has the format:
 *   <domain>, <publisher_account_id>, <relationship>, [<certification_authority_id>]
 *
 * - Field #1 (domain): The canonical domain of the advertising system (e.g. google.com)
 * - Field #2 (publisher_account_id): Publisher's account ID in the ad system
 * - Field #3 (relationship): DIRECT or RESELLER
 * - Field #4 (certification_authority_id): Optional TAG certification ID
 *
 * @param {string} content - Raw text content of the ads.txt file
 * @returns {{ isValid: boolean, entries: Array<{domain: string, publisherId: string, relationship: string, certId: string|null}> }}
 */
export function parseAdsTxt(content) {
    if (!content || typeof content !== 'string') {
        return { isValid: false, entries: [] };
    }

    const lines = content.split('\n');
    const entries = [];

    for (const rawLine of lines) {
        const line = rawLine.trim();

        // Skip empty lines and comments
        if (!line || line.startsWith('#')) continue;

        // Skip variable declarations (e.g. "contact=..." or "subdomain=...")
        if (line.includes('=') && !line.includes(',')) continue;

        // Split by comma — IAB spec requires comma-separated fields
        const fields = line.split(',');

        if (fields.length < 3) continue;

        const domain = fields[0].trim().toLowerCase();
        const publisherId = fields[1].trim();
        const relationship = fields[2].trim().toUpperCase();
        const certId = fields[3] ? fields[3].trim() : null;

        // Validate relationship field
        if (relationship !== 'DIRECT' && relationship !== 'RESELLER') continue;

        entries.push({
            domain,
            publisherId,
            relationship,
            certId,
        });
    }

    return { isValid: entries.length > 0, entries };
}

/**
 * Check if an ads.txt file contains a valid DV360 (Google) entry.
 * Looks for any line where domain is "google.com" and relationship is DIRECT or RESELLER.
 *
 * @param {string} content - Raw text content of the ads.txt file
 * @returns {boolean}
 */
export function hasDV360Entry(content) {
    const { entries } = parseAdsTxt(content);

    return entries.some(
        (entry) =>
            entry.domain === 'google.com' &&
            (entry.relationship === 'DIRECT' || entry.relationship === 'RESELLER')
    );
}
