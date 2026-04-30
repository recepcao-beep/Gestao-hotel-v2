const dotenv = require('dotenv');
dotenv.config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
);

async function test() {
  const { data, error } = await supabase.from('apartments').select('*').limit(5);
  console.log("Error:", error);
  console.log("Data length:", data ? data.length : 0);
  if (data && data.length > 0) {
    console.log("First row keys:", Object.keys(data[0]));
    console.log("First row hotel_name:", data[0].hotel_name);
    console.log("First row data:", data[0].data);
  }
}
test();
