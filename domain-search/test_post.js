
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if(k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
    const { error: deleteError } = await supabase
        .from('inventory_categories')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('Delete error:', deleteError);
    const { error: insertError } = await supabase
        .from('inventory_categories')
        .insert([{category_name: 'News'}]);
    console.log('Insert error:', insertError);
})();

