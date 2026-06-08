/**
 * Parse a URL string into root domain, subdomain, and path components.
 * Handles two-part TLDs (e.g. .co.uk, .com.pl).
 */
export function parseUrl(urlString) {
    if (!urlString) return null;
    let normalized = urlString.trim();
    if (!normalized.startsWith('http')) {
        normalized = 'https://' + normalized;
    }

    try {
        const url = new URL(normalized);
        const hostname = url.hostname;

        // Validation: Must have at least one dot to be a valid domain
        if (!hostname.includes('.')) {
            return null;
        }

        const pathname = url.pathname;

        const parts = hostname.split('.');
        let rootDomain = '';
        let subdomain = '';

        // Known two-part TLDs
        const twoPartTLDs = [
            'co.uk', 'co.jp', 'co.kr', 'co.in', 'co.nz', 'co.za',
            'com.au', 'com.br', 'com.pl', 'com.tr', 'com.mx', 'com.ar',
            'org.uk', 'org.pl', 'org.au',
            'net.pl', 'net.au',
            'gov.uk', 'gov.pl',
            'edu.pl', 'edu.au',
            'waw.pl', 'wroc.pl', 'krakow.pl', 'poznan.pl',
        ];

        const lastTwo = parts.slice(-2).join('.');

        if (parts.length >= 3 && twoPartTLDs.includes(lastTwo)) {
            rootDomain = parts.slice(-3).join('.');
            subdomain = parts.slice(0, -3).join('.') || '';
        } else if (parts.length >= 2) {
            rootDomain = parts.slice(-2).join('.');
            subdomain = parts.slice(0, -2).join('.') || '';
        } else {
            rootDomain = hostname;
        }

        // Treat "www" as root (not a subdomain)
        if (subdomain === 'www') {
            subdomain = '';
        }

        // Clean path
        const cleanPath = pathname === '/' ? '' : pathname;

        // Display Path: hostname + first segment of path
        const pathSegments = cleanPath.split('/').filter(Boolean);
        let displayPath = hostname.replace('www.', '');
        if (pathSegments.length > 0) {
            displayPath += '/' + pathSegments[0];
        }

        return {
            full_url: urlString,
            root_domain: rootDomain,
            subdomain: subdomain || null,
            path: cleanPath || null,
            display_path: displayPath,
        };
    } catch {
        return null;
    }
}
