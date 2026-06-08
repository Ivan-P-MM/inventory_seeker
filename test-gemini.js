import { mutateKeyword } from './domain-search/lib/gemini.js';
import dotenv from 'dotenv';
dotenv.config({ path: './domain-search/.env.local' });

async function testGemini() {
    try {
        console.log('Testing Gemini API with gemini-2.0-flash...');
        const newKeyword = await mutateKeyword('blog motorcycles', []);
        console.log('Success! New keyword generated:', newKeyword);
    } catch (err) {
        console.error('Gemini API Test Failed:', err.message);
    }
}

testGemini();
