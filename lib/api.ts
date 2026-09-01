import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Role } from "@/app/config";
import { canSeePage, pageOfApiPath } from "@/lib/access";

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  appRole: AppRole;
  pageAccess: string[];
  companyId: string;
};

export const badRequest = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export const forbidden = (
  message = "Your account has view-only access. Ask an owner to change your role."
) => NextResponse.json({ error: message }, { status: 403 });

export const notFound = (message = "Not found.") =>
  NextResponse.json({ error: message }, { status: 404 });

/**
 * The signed-in staff member, for API routes.
 * Returns { error } instead of redirecting, so routes answer with JSON.
 * Identity always comes from the auth cookie — never from the request body.
 */
export async function requireApiUser(): Promise<
  { user: ApiUser } | { error: NextResponse }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return { error: badRequest("You are signed out. Sign in again.", 401) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, role, app_role, page_access, company_id")
    .eq("id", user.id)
    .single();

  if (!profile)
    return { error: badRequest("Your account isn't attached to a company.", 403) };

  const apiUser: ApiUser = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role as Role,
    appRole: (profile.app_role as AppRole) ?? "pm",
    pageAccess: (profile.page_access as string[]) ?? [],
    companyId: profile.company_id,
  };

  /**
   * The page behind this route, checked here rather than in each route.
   * Hiding a link is a courtesy; this is the actual boundary — a project
   * manager who has only Schedule Payments cannot reach /api/projects by
   * typing it, whatever the menu shows them.
   */
  const page = pageOfApiPath(headers().get("x-sfl-path") ?? "");
  if (page && !canSeePage(apiUser, page))
    return {
      error: forbidden(
        "Your account doesn't have access to that part of the app."
      ),
    };

  return { user: apiUser };
}
