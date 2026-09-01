import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiUser, forbidden, badRequest } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { APP_ROLES, DEFAULT_PM_ACCESS, ROLE_LABEL, type AppRole } from "@/app/config";
import { createPasswordLink, sendPasswordEmail } from "@/lib/passwordLink";

/**
 * POST /api/team — add a teammate. Owners only.
 *
 * Creates the account and emails them a one-time link to choose their
 * own password. No password is generated, shown or stored: one that
 * travels by email can be used by anyone who can read that inbox, and
 * one read out loud tends to stay written on a desk.
 *
 * The wording lives in the team_invite template, edited on Templates,
 * apart from the three that are written to subcontractors.
 */
export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (user.appRole !== "admin")
    return forbidden("Only an owner can add or change team members.");

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const appRole = String(body?.role ?? "pm");

  if (!name) return badRequest("Enter their name.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return badRequest("Enter a valid email address.");
  if (!(APP_ROLES as readonly string[]).includes(appRole))
    return badRequest("Pick Admin or Project manager.");

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (existing) return badRequest("Someone with that email is already on the team.");

  const admin = createAdminClient();

  // No password at all — they set one from the link below. Confirming
  // the address here is what lets that link be issued straight away.
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
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
    /*
      The RLS role follows from app_role in the database (trigger
      profiles_sync_role), so only the one people see is set here. A new
      project manager starts with the payment schedule and their own
      account — never with everything — and an admin's list is stored but
      ignored while they are an admin.
    */
    app_role: appRole,
    page_access: appRole === "admin" ? [] : DEFAULT_PM_ACCESS,
    role: appRole === "admin" ? "owner" : "staff",
  });

  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    return badRequest("Couldn't finish setting up that account.");
  }

  /**
   * The account exists either way — a mail failure must not undo it, or
   * we would delete a working account because Resend had a bad minute.
   * The caller is told plainly, and can send the invitation again.
   */
  let emailed = false;
  let emailError: string | null = null;

  const link = await createPasswordLink(email);

  if (!link.ok) {
    emailError = "Couldn't create the sign-in link. Send the invitation again.";
  } else {
    const sent = await sendPasswordEmail({
      kind: "team_invite",
      to: email,
      companyId: user.companyId,
      fields: {
        name,
        email,
        set_password_url: link.url,
        role: ROLE_LABEL[appRole as AppRole],
        invited_by: user.name,
      },
    });
    emailed = sent.ok;
    if (!sent.ok) emailError = sent.error;
  }

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "created",
    text: `${user.name} added ${name} to the team${emailed ? " and emailed them" : ""}`,
    meta: appRole,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true, email, emailed, emailError });
}
