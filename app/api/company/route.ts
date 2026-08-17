import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";

/**
 * PATCH /api/company — the company's own details.
 *
 * Owner only. This is what every sub sees on every email and in the
 * portal, so it isn't something a staff account should be able to
 * rewrite.
 */
export async function PATCH(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  if (user.role !== "owner")
    return forbidden("Only the owner can change company details.");

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Bad request.");

  const name = String(body.name ?? "").trim();
  if (!name) return badRequest("Company name is required.");

  const email = (value: unknown) => String(value ?? "").trim().toLowerCase();
  const fromEmail = email(body.fromEmail);
  const replyTo = email(body.replyTo);

  for (const [value, label] of [
    [fromEmail, "The 'from' address"],
    [replyTo, "The reply-to address"],
  ] as const) {
    if (value && !/^\S+@\S+\.\S+$/.test(value))
      return badRequest(`${label} doesn't look like a valid email.`);
  }

  const text = (value: unknown) => String(value ?? "").trim() || null;

  const supabase = createClient();
  const { error } = await supabase
    .from("companies")
    .update({
      name,
      region: text(body.region),
      phone: text(body.phone),
      address: text(body.address),
      city: text(body.city),
      state: text(body.state),
      zip: text(body.zip),
      license_number: text(body.licenseNumber),
      website: text(body.website),
      from_email: fromEmail || null,
      reply_to_email: replyTo || null,
    })
    .eq("id", user.companyId);

  if (error) return badRequest("Couldn't save that. Try again.");

  await supabase.from("activity").insert({
    company_id: user.companyId,
    type: "updated",
    text: `${user.name} updated the company details`,
    actor_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
