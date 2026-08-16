import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/app/config";

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
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
    .select("id, name, email, role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile)
    return { error: badRequest("Your account isn't attached to a company.", 403) };

  return {
    user: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role as Role,
      companyId: profile.company_id,
    },
  };
}
