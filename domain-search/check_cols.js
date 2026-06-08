const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '.env.local');
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
        env[key] = value;
    }
});

async function check() {
    try {
        const supabase = createClient(
            env.NEXT_PUBLIC_SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data, error } = await supabase
            .from('advertiser_inventory')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error fetching:', error);
        } else {
            console.log('Columns in advertiser_inventory:', data && data.length > 0 ? Object.keys(data[0]) : 'Empty table or no data');
            if (data && data.length === 0) {
                // If it is empty, let's try to inspect the schema or insert a dummy row to see columns
                console.log('Table is empty. Let\'s try to insert a temporary row and roll it back, or just fetch using postgres if possible.');
            }
        }
    } catch (err) {
        console.error('Catch error:', err);
    }
}

check();
