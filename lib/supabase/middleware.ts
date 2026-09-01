import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Public routes — everything else requires a signed-in staff user. */
const PUBLIC = [
  "/login",
  "/auth",
  "/portal",
  "/api/portal",
  // Setting a password proves who you are with the link itself, so these
  // have to work for someone who is signed out — that is the whole point.
  "/forgot-password",
  "/set-password",
  "/api/auth",
];

/**
 * The path, passed on as a header.
 *
 * A server component can't see the URL it is rendering, and API routes
 * would each have to be edited to pass their own path. One header set
 * here lets the staff layout and requireApiUser both ask "which page is
 * this?" without touching either of them again.
 */
const PATH_HEADER = "x-sfl-path";

function withPath(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, request.nextUrl.pathname);
  return { request: { headers } };
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next(withPath(request));

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
          response = NextResponse.next(withPath(request));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth cookie. Do not remove or delete-then-recreate.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
