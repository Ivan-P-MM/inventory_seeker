import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Generate a mutated keyword variant using Google Gemini API.
 *
 * @param {string} keyword - The original/current keyword
 * @param {string[]} previousKeywords - Keywords already used (to avoid repetition)
 * @returns {Promise<string>} A new keyword variant
 */
export async function mutateKeyword(keyword, previousKeywords = []) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const usedList = previousKeywords.length > 0
        ? `\nAlready used keywords (DO NOT repeat these): ${previousKeywords.join(', ')}`
        : '';

    const prompt = `You are a search keyword optimization expert. Generate ONE new search keyword that is semantically related to "${keyword}" but different enough to produce new Google search results.

Rules:
- Return ONLY the keyword (no quotes, no explanation, no numbering)
- Keep the same topical intent
- Use a synonym, rephrasing, or related angle
- Must be a natural search query (2-5 words)${usedList}

New keyword:`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();

    // Clean up any quotes or extra formatting
    return text.replace(/^["']|["']$/g, '').trim();
}
