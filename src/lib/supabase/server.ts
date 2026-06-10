import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kdbahmqvvkmcfytmuhsb.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYmFobXF2dmttY2Z5dG11aHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDkyMzg0MDAsImV4cCI6MTkwNDgxMjgwMH0.dummy";

  const client = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );

  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    // @ts-ignore - Mock auth for offline/development fallback
    client.auth.getUser = async () => {
      const mockSession = cookieStore.get("acadnexus_mock_session")?.value;
      if (mockSession) {
        try {
          return { data: { user: JSON.parse(mockSession) }, error: null };
        } catch {}
      }
      return { data: { user: null }, error: null };
    };

    // @ts-ignore
    client.auth.signOut = async () => {
      cookieStore.set("acadnexus_mock_session", "", { maxAge: -1 });
      return { error: null };
    };
  }

  return client;
}
