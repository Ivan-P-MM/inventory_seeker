import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

/**
 * Parse a URL string into its domain, subdomain, and subfolder components.
 */
function parseUrl(urlString) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;
    const pathname = url.pathname;

    // Extract domain parts
    const parts = hostname.split('.');
    let rootDomain = '';
    let subdomain = '';

    // Handle known two-part TLDs (e.g. .co.uk, .com.pl, .org.pl)
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
    const lastThree = parts.slice(-3).join('.');

    if (parts.length >= 3 && twoPartTLDs.includes(lastTwo)) {
      // e.g. forum.example.com.pl → root=example.com.pl, sub=forum
      rootDomain = parts.slice(-3).join('.');
      subdomain = parts.slice(0, -3).join('.') || '';
    } else if (parts.length >= 2) {
      // e.g. forum.example.pl → root=example.pl, sub=forum
      rootDomain = parts.slice(-2).join('.');
      subdomain = parts.slice(0, -2).join('.') || '';
    } else {
      rootDomain = hostname;
    }

    // Remove "www" from subdomain — treat it as root
    if (subdomain === 'www') {
      subdomain = '';
    }

    // Extract subfolders (path segments)
    const subfolders = pathname
      .split('/')
      .filter(segment => segment.length > 0)
      .map(segment => '/' + segment);

    return {
      fullUrl: urlString,
      rootDomain,
      subdomain: subdomain || null,
      subfolders: subfolders.length > 0 ? subfolders : [],
    };
  } catch (e) {
    return null;
  }
}

/**
 * Fetch one page of Google results from SerpAPI.
 */
async function fetchSerpApiPage(apiKey, keyword, language, region, start) {
  const params = new URLSearchParams({
    q: keyword,
    hl: language,
    gl: region,
    start: start.toString(),
    num: '10',
    engine: 'google',
    api_key: apiKey,
  });

  const response = await fetch(`https://serpapi.com/search.json?${params}`);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SerpAPI error (${response.status}): ${body}`);
  }

  return response.json();
}

/**
 * POST /api/search
 * Body: { keyword, language, region, apiKey, numResults }
 */
app.post('/api/search', async (req, res) => {
  const { keyword, language = 'pl', region = 'pl', apiKey, numResults = 100 } = req.body;

  if (!keyword || !apiKey) {
    return res.status(400).json({ error: 'keyword and apiKey are required.' });
  }

  try {
    const totalPages = Math.ceil(Math.min(numResults, 100) / 10);
    const allResults = [];

    for (let page = 0; page < totalPages; page++) {
      const start = page * 10;
      const data = await fetchSerpApiPage(apiKey, keyword, language, region, start);

      const organicResults = data.organic_results || [];

      for (const result of organicResults) {
        const parsed = parseUrl(result.link);
        if (parsed) {
          parsed.title = result.title || '';
          parsed.snippet = result.snippet || '';
          allResults.push(parsed);
        }
      }

      // If there are no more results, stop early
      if (!organicResults.length || organicResults.length < 10) {
        break;
      }
    }

    // Group results by root domain
    const domainMap = new Map();

    for (const result of allResults) {
      const key = result.rootDomain;

      if (!domainMap.has(key)) {
        domainMap.set(key, {
          rootDomain: key,
          subdomains: new Set(),
          subfolders: new Set(),
          pages: [],
        });
      }

      const group = domainMap.get(key);

      if (result.subdomain) {
        group.subdomains.add(result.subdomain);
      }

      for (const sf of result.subfolders) {
        group.subfolders.add(sf);
      }

      group.pages.push({
        fullUrl: result.fullUrl,
        title: result.title,
        snippet: result.snippet,
        subdomain: result.subdomain,
        subfolders: result.subfolders,
      });
    }

    // Convert Sets to Arrays for JSON serialization
    const grouped = Array.from(domainMap.values()).map(group => ({
      rootDomain: group.rootDomain,
      subdomains: [...group.subdomains],
      subfolders: [...group.subfolders],
      pageCount: group.pages.length,
      pages: group.pages,
    }));

    res.json({
      keyword,
      language,
      region,
      totalResults: allResults.length,
      domainCount: grouped.length,
      domains: grouped,
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Domain Search API running at http://localhost:${PORT}`);
});
