import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kdbahmqvvkmcfytmuhsb.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYmFobXF2dmttY2Z5dG11aHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDkyMzg0MDAsImV4cCI6MTkwNDgxMjgwMH0.dummy";
  
  return createBrowserClient(supabaseUrl, supabaseKey);
}
