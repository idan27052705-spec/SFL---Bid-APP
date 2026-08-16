import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiUser, forbidden, badRequest } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { ROLES } from "@/app/config";

/**
 * POST /api/team — add a teammate. Owners only.
 *
 * Creates the account outright with a one-time password that comes back
 * once, for the owner to pass on. That's deliberate: an emailed invite
 * link depends on mail that can bounce or sit in spam, and the person is
 * usually sitting in the same office. They change it on My account.
 */
export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (user.role !== "owner")
    return forbidden("Only an owner can add or change team members.");

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const role = String(body?.role ?? "staff");

  if (!name) return badRequest("Enter their name.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return badRequest("Enter a valid email address.");
  if (!ROLES.includes(role as never)) return badRequest("Unknown role.");
  if (role === "owner") return badRequest("Add them as staff first, then change the role.");

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (existing) return badRequest("Someone with that email is already on the team.");

  const admin = createAdminClient();
  const password = `Sfl-${randomBytes(9).toString("base64url")}`;

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !created.user)
    return badRequest(
      authError?.message.toLowerCase().includes("already")
        ? "That email already has an account."
        : "Couldn't create that account."
    );

  const { error } = await admin.from("profiles").insert({
    id: created.user.id,
    company_id: user.companyId,
    name,
    email,
    role,
  });

  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    return badRequest("Couldn't finish setting up that account.");
  }

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "created",
    text: `${user.name} added ${name} to the team`,
    meta: role,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true, password, email });
}
