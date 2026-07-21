import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isApprovedUser } from "@/lib/authz";

const AUTH_TIMEOUT_MS = 2500;

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  const response = NextResponse.redirect(url);

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name.includes("supabase")) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }

  return response;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("auth-timeout")), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/auth");
  const isSignupRoute = pathname.startsWith("/signup") || pathname.startsWith("/api/signup");
  const isLoginRoute = pathname.startsWith("/login");
  const isPendingRoute = pathname.startsWith("/pending");
  const isPublicRoute = isLoginRoute || isSignupRoute || isAuthRoute;

  // Public pages must not wait on Supabase auth. Stale browser cookies can make
  // auth validation hang in Vercel middleware and surface as MIDDLEWARE_INVOCATION_TIMEOUT.
  if (isPublicRoute) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  let user = null;
  try {
    const result = await withTimeout(supabase.auth.getClaims(), AUTH_TIMEOUT_MS);
    if (result.error) {
      return redirectToLogin(request);
    }

    const claims = result.data?.claims as
      | { email?: string; app_metadata?: Record<string, unknown> }
      | undefined;
    if (claims) {
      user = {
        email: claims.email,
        app_metadata: claims.app_metadata ?? {},
      };
    }
  } catch {
    return redirectToLogin(request);
  }

  if (!user) {
    return redirectToLogin(request);
  }

  if (!isApprovedUser(user)) {
    if (!isPendingRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  if (isPendingRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}