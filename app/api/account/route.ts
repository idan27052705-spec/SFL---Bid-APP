import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/account — the signed-in user edits THEIR OWN name, email or password.
 *
 * Rules enforced here (never trust the browser):
 *  - You may only ever edit yourself. The row id comes from the auth cookie,
 *    never from the request body, so no one can edit another user by id.
 *  - Role and company are not editable here at all, by anyone. Changing
 *    someone's role is a Team & roles action, owner-only.
 *  - Every role — owner, staff AND viewer — may edit their own account.
 *    "Viewer is read-only" is about company data, not a person's own login.
 *  - Changing email or password requires the current password. Name does not.
 *  - A wrong current password fails without saying which field was wrong.
 */

type Body = {
  name?: string;
  email?: string;
  newPassword?: string;
  currentPassword?: string;
};

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return bad("You are signed out. Sign in again.", 401);

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return bad("Bad request.");
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const newPassword = body.newPassword ?? "";
  const currentPassword = body.currentPassword ?? "";

  const emailChanged = !!email && email !== (user.email ?? "").toLowerCase();
  const passwordChanged = newPassword.length > 0;

  // ── validation ────────────────────────────────────────────────────
  if (name !== undefined && name.length === 0)
    return bad("Name can't be empty.");

  if (email !== undefined && email.length > 0 && !/^\S+@\S+\.\S+$/.test(email))
    return bad("That doesn't look like a valid email address.");

  if (passwordChanged && newPassword.length < 8)
    return bad("New password must be at least 8 characters.");

  if ((emailChanged || passwordChanged) && !currentPassword)
    return bad("Enter your current password to change your email or password.");

  // ── re-authenticate before anything sensitive ─────────────────────
  if (emailChanged || passwordChanged) {
    const check = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error } = await check.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });
    if (error) return bad("Your current password isn't right.");
  }

  const admin = createAdminClient();

  // ── auth record (email / password) ────────────────────────────────
  if (emailChanged || passwordChanged) {
    const patch: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (emailChanged) {
      patch.email = email;
      patch.email_confirm = true;
    }
    if (passwordChanged) patch.password = newPassword;

    const { error } = await admin.auth.admin.updateUserById(user.id, patch);
    if (error) {
      return bad(
        error.message.toLowerCase().includes("already")
          ? "Another account already uses that email address."
          : "Couldn't save that. Try again."
      );
    }
  }

  // ── profile record (name / email mirror) ──────────────────────────
  // Only name and email. Role and company_id are deliberately absent.
  const profilePatch: { name?: string; email?: string } = {};
  if (name !== undefined) profilePatch.name = name;
  if (emailChanged) profilePatch.email = email;

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("id", user.id);

    if (error) return bad("Couldn't save your details. Try again.");
  }

  return NextResponse.json({
    ok: true,
    emailChanged,
    passwordChanged,
  });
}
