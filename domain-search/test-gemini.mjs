import { GoogleGenerativeAI } from '@google/generative-ai';
import process from 'node:process';
import fs from 'node:fs';
process.loadEnvFile('.env.local');

async function testWorkingModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelsToTry = [
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-flash-latest',
        'gemini-pro-latest'
    ];

    const results = [];
    for (const m of modelsToTry) {
        try {
            console.log(`Trying model: ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent('Generate a synonym for "motorcycles"');
            const text = result.response.text().trim();
            results.push({ model: m, success: true, response: text });
            console.log(`Success with ${m}!`);
        } catch (err) {
            results.push({ model: m, success: false, error: err.message });
            console.log(`Failed ${m}: ${err.message}`);
        }
    }
    fs.writeFileSync('result.json', JSON.stringify(results, null, 2));
}

testWorkingModels();
