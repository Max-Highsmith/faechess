import { createClient } from '@supabase/supabase-js';

// Get environment variables (Vite exposes them via import.meta.env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Checking Supabase environment variables...');
console.log('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Found' : '❌ Missing');
console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Found' : '❌ Missing');

let supabase;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.warn('Creating placeholder client - auth features will not work');
  console.warn('To fix: restart dev server with Ctrl+C then npm run dev');

  // Create a dummy client to prevent crashes (auth won't work but game will)
  supabase = createClient(
    'https://placeholder.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
} else {
  console.log('✅ Supabase configured successfully!');

  // Create Supabase client for browser
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
}

export default supabase;
