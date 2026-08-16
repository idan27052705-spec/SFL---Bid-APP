import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/app/config";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string;
  companyName: string;
};

/**
 * The signed-in staff member plus their company.
 * Redirects to /login if there is no session, and to /login?error=noprofile
 * if the auth user exists but was never attached to a company.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, role, company_id, companies(name)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login?error=noprofile");

  const company = profile.companies as unknown as { name: string } | null;

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as Role,
    companyId: profile.company_id,
    companyName: company?.name ?? "",
  };
}

/** True when the user is allowed to change data. Viewers are read-only. */
export function canWrite(user: CurrentUser) {
  return user.role === "owner" || user.role === "staff";
}

/** Use in API routes that must reject viewers. */
export function assertCanWrite(user: CurrentUser) {
  if (!canWrite(user)) {
    throw new Error("Your account has view-only access.");
  }
}
