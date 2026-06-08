import { GoogleGenerativeAI } from '@google/generative-ai';
import process from 'node:process';
import fs from 'node:fs';
process.loadEnvFile('.env.local');

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // The SDK doesn't have a direct listModels in the main export usually, 
        // but we can try to fetch it via the internal client if available or just try common names.
        // Actually, let's try 'gemini-pro' as a fallback.
        console.log('Trying gemini-pro...');
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent('Hi');
        console.log('gemini-pro works!');
        fs.writeFileSync('models.json', JSON.stringify({ success: true, workingModel: 'gemini-pro' }));
    } catch (err) {
        console.log('gemini-pro failed:', err.message);
        fs.writeFileSync('models.json', JSON.stringify({ success: false, error: err.message }));
    }
}

listModels();
