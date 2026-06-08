const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
        }
        env[key] = value.trim();
    }
});

const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log('Checking advertisers table:');
    const r1 = await supabase.from('advertisers').select('*');
    if (r1.error) {
        console.error('advertisers error:', r1.error.message);
    } else {
        console.log('advertisers count:', r1.data.length);
    }

    console.log('Checking advertiser_domains table:');
    const r2 = await supabase.from('advertiser_domains').select('*');
    if (r2.error) {
        console.error('advertiser_domains error:', r2.error.message);
    } else {
        console.log('advertiser_domains count:', r2.data.length);
    }
}

run();
