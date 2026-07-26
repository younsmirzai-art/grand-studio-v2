import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
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
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publicPaths = [
    "/",
    "/browse", // public model browsing (Phase 3)
    "/model", // model detail pages, view-only (Phase 4)
    "/plugin", // plugin showcase page (Phase 5)
    "/pricing", // pricing page (Phase 6)
    "/support", // legal/info — now public for Fab
    "/privacy", // legal/info — now public for Fab
    "/terms", // legal/info — now public for Fab
    "/auth/login",
    "/auth/signup",
    "/auth/callback",
    "/auth/epic",
    "/auth/magic-link",
  ];

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/" ||
    // API routes enforce their own auth (webhooks, plugin BYOK, etc.)
    pathname.startsWith("/api/") ||
    publicPaths.some(
      (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`))
    );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
