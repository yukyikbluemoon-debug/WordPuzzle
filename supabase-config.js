// Supabase Configuration
const SUPABASE_URL = 'https://pwrhnmvhwhellfbznczb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zmIZ9aucZsRMJrySDe0uIQ_W4OgndeO';

// Initialize Supabase client (เปลี่ยนชื่อจาก supabase เป็น supabaseClient)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
