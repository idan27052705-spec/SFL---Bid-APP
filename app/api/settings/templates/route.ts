import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";

/** PATCH /api/settings/templates — save one template, and the custom fields. */
export async function PATCH(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  if (user.role === "viewer") return forbidden();

  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Bad request.");

  const supabase = createClient();

  if (body.kind) {
    const kind = String(body.kind);
    if (!["invite", "reminder", "award", "team_invite"].includes(kind))
      return badRequest("Unknown template.");

    const subject = String(body.subject ?? "").trim();
    const text = String(body.body ?? "").trim();
    if (!subject) return badRequest("The subject can't be empty.");
    if (!text) return badRequest("The message body can't be empty.");

    const { error } = await supabase
      .from("email_templates")
      .update({ subject, body: text, sms: String(body.sms ?? "").trim() || null })
      .eq("company_id", user.companyId)
      .eq("kind", kind);

    if (error) return badRequest("Couldn't save the template.");
  }

  if (Array.isArray(body.customFields)) {
    const clean = body.customFields
      .map((c: { key?: string; value?: string }) => ({
        key: String(c.key ?? "").replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 40),
        value: String(c.value ?? "").slice(0, 400),
      }))
      .filter((c: { key: string }) => c.key.length > 0);

    const { error } = await supabase
      .from("settings")
      .update({ custom_fields: clean })
      .eq("company_id", user.companyId);

    if (error) return badRequest("Couldn't save the custom fields.");
  }

  return NextResponse.json({ ok: true });
}
