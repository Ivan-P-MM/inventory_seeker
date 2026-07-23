import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function categorizeDomain(domain, supabase) {
    try {
        // Fetch categories from DB
        const { data: catData, error: catError } = await supabase
            .from('inventory_categories')
            .select('category_name');
            
        if (catError) {
            console.error('[Gemini] DB Error fetching categories:', catError);
            return null;
        }

        const allowedCategories = catData.map(c => c.category_name);
        if (allowedCategories.length === 0) {
            console.warn('[Gemini] No categories found in database, skipping categorisation.');
            return null;
        }

        // Fetch website content
        // Note: ensure we use https or http. Try https first.
        const url = `https://${domain}`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            signal: AbortSignal.timeout(10000) // 10s timeout
        });
        
        if (!res.ok) {
            console.warn(`[Gemini] Failed to fetch ${url}, status: ${res.status}`);
            return 'Uncategorized'; // Or try http, but we'll default to Uncategorized if unreachable
        }

        const html = await res.text();
        
        // Strip HTML to get rough text
        // This is a naive regex strip for HTML tags, styles, scripts
        let textContent = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
            
        // Truncate to save tokens (e.g., first 10,000 characters is usually enough for a category)
        textContent = textContent.slice(0, 10000);

        const prompt = `# Role
You are an objective, high-precision text classification engine specializing in web content analysis.

# Task
Analyze the provided website content and classify it into exactly ONE category from the strict list of allowed categories provided below. 

# Rules and Constraints
1. **Strict Selection:** You must choose exactly one category from the "Allowed Categories" list. Do not alter the spelling, capitalization, or formatting of the category name.
2. **No Hallucinations:** Do not invent, merge, or create new categories under any circumstances.
3. **Fallback Protocol:** If the content absolutely does not map to any of the listed categories, classify it strictly as "Uncategorized".
4. **Output Format:** Output only the final category name. Do not include introductory phrases, markdown formatting outside of plain text, explanations, or justifications.

# Allowed Categories
${allowedCategories.join('\n')}

# Website Content
${textContent}`;

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        
        // Verify it's an exact match or 'Uncategorized'
        if (allowedCategories.includes(responseText) || responseText === 'Uncategorized') {
            return responseText;
        } else {
            console.warn(`[Gemini] Invalid category returned: ${responseText}`);
            // Attempt case-insensitive match just in case
            const match = allowedCategories.find(c => c.toLowerCase() === responseText.toLowerCase());
            return match || 'Uncategorized';
        }
    } catch (err) {
        console.error(`[Gemini] Categorization failed for ${domain}:`, err.message);
        return 'Uncategorized';
    }
}
