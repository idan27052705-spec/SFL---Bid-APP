import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, PageKey, Role } from "@/app/config";
import { canSeePage, firstAllowedHref, pageOfPath } from "@/lib/access";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** The only role the interface shows: admin or pm. */
  appRole: AppRole;
  /** Page keys this person may open. An admin ignores it. */
  pageAccess: string[];
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
    .select("id, name, email, role, app_role, page_access, company_id, companies(name)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login?error=noprofile");

  const company = profile.companies as unknown as { name: string } | null;

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as Role,
    appRole: (profile.app_role as AppRole) ?? "pm",
    pageAccess: (profile.page_access as string[]) ?? [],
    companyId: profile.company_id,
    companyName: company?.name ?? "",
  };
}

/**
 * The signed-in user, refused if this page isn't theirs.
 *
 * Called once in the staff layout, which wraps every staff page, so a
 * page cannot forget to check. Someone who lands somewhere they don't
 * have — an old bookmark, a link from a colleague — is sent to the first
 * page they do have rather than shown an error they can't act on.
 */
export async function requirePageUser(): Promise<CurrentUser> {
  const user = await requireUser();

  const path = headers().get("x-sfl-path") ?? "";
  const page = pageOfPath(path);

  // A path outside the map isn't access-controlled here.
  if (page && !canSeePage(user, page)) redirect(firstAllowedHref(user));

  return user;
}

/** Does this person have that page? For hiding what they can't open. */
export const hasPage = (user: CurrentUser, key: PageKey) =>
  canSeePage(user, key);

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
