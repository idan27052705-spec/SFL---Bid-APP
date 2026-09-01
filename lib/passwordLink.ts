import { createAdminClient } from "@/lib/supabase/admin";
import { getCompany } from "@/lib/company";
import { renderTemplate, sendEmail, siteUrl } from "@/lib/email";

/**
 * One-time links for setting a password — used to invite a teammate and
 * to reset a forgotten password. The same machinery, because they are
 * the same act: prove you can read that inbox, then choose a password.
 *
 * We ask Supabase for the link but send it ourselves, so the message
 * comes from the company's own address with wording that is editable on
 * the Templates page — not from Supabase's default mail.
 *
 * We take the token out of Supabase's link and put it on OUR address
 * rather than forwarding theirs. Two reasons: the person stays on
 * bids.sflbuildersgroup.com the whole way, which is what they were told
 * to expect; and the browser that opens the link is not the one that
 * started the flow, so the redirect dance Supabase expects for a normal
 * sign-in doesn't apply. /set-password redeems the token directly.
 */

export type LinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function createPasswordLink(email: string): Promise<LinkResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  const hashed = data?.properties?.hashed_token;
  if (error || !hashed)
    return { ok: false, error: error?.message ?? "Couldn't create a link." };

  return {
    ok: true,
    url: `${siteUrl()}/set-password?token=${encodeURIComponent(hashed)}`,
  };
}

/**
 * Renders a template and sends it. Returns quietly on a missing
 * template so a caller can decide what that means — for an invitation
 * it's worth reporting, for a password reset we say nothing either way.
 */
export async function sendPasswordEmail({
  kind,
  to,
  companyId,
  fields,
}: {
  kind: "team_invite" | "password_reset";
  to: string;
  companyId: string;
  fields: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: template } = await admin
    .from("email_templates")
    .select("subject, body")
    .eq("company_id", companyId)
    .eq("kind", kind)
    .maybeSingle();

  if (!template)
    return { ok: false, error: "That email template doesn't exist yet." };

  const company = await getCompany(companyId);
  const merged = {
    ...fields,
    company_name: company.name,
    company_phone: company.phone,
    sign_in_url: `${siteUrl()}/login`,
  };

  const result = await sendEmail({
    companyId,
    to,
    subject: renderTemplate(template.subject, merged),
    text: renderTemplate(template.body, merged),
  });

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
