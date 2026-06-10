import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kdbahmqvvkmcfytmuhsb.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYmFobXF2dmttY2Z5dG11aHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDkyMzg0MDAsImV4cCI6MTkwNDgxMjgwMH0.dummy";

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const isMockAuth = !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let user: any = null;

  if (isMockAuth) {
    const mockSession = request.cookies.get("acadnexus_mock_session")?.value;
    if (mockSession) {
      try {
        user = JSON.parse(mockSession);
      } catch (err) {}
    }
  } else {
    // Refresh session if it exists, and get user
    const {
      data: { user: realUser },
    } = await supabase.auth.getUser();
    user = realUser;
  }

  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Root login route
  if (path === "/") {
    if (user) {
      const role = user.user_metadata?.role;
      return redirectUserToDashboard(role, url);
    }
    return response;
  }

  // Dashboard routes
  if (path.startsWith("/dashboard")) {
    if (!user) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    const role = user.user_metadata?.role;

    // Check specific role routes
    if (path.startsWith("/dashboard/student") && role !== "Student") {
      return redirectUserToDashboard(role, url);
    }
    if (path.startsWith("/dashboard/faculty") && role !== "Faculty") {
      return redirectUserToDashboard(role, url);
    }
    if (path.startsWith("/dashboard/chair") && role !== "Chair") {
      return redirectUserToDashboard(role, url);
    }
    if (path.startsWith("/dashboard/director") && role !== "Director") {
      return redirectUserToDashboard(role, url);
    }

    // If accessing plain /dashboard, redirect based on role
    if (path === "/dashboard" || path === "/dashboard/") {
      return redirectUserToDashboard(role, url);
    }
  }

  return response;
}

function redirectUserToDashboard(role: string | undefined, url: URL) {
  if (role === "Student") {
    url.pathname = "/dashboard/student";
  } else if (role === "Faculty") {
    url.pathname = "/dashboard/faculty";
  } else if (role === "Chair") {
    url.pathname = "/dashboard/chair";
  } else if (role === "Director") {
    url.pathname = "/dashboard/director";
  } else {
    url.pathname = "/";
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, png, svg, etc.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
