import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest } from "@/lib/api";
import { wrongOrigin } from "@/lib/guard";
import { REMINDER_CADENCES } from "@/app/config";

/** PATCH /api/settings/reminders — the defaults applied to every new bid. */
export async function PATCH(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  if (user.role === "viewer") return forbidden();

  const body = await request.json().catch(() => null);
  const cadence = String(body?.cadence ?? "");
  const cap = Number(body?.cap);

  if (!REMINDER_CADENCES.includes(cadence as never))
    return badRequest("That cadence isn't valid.");
  if (!Number.isInteger(cap) || cap < 0 || cap > 20)
    return badRequest("Maximum reminders must be a whole number between 0 and 20.");

  const supabase = createClient();
  const { error } = await supabase
    .from("settings")
    .update({ default_cadence: cadence, reminder_cap: cap })
    .eq("company_id", user.companyId);

  if (error) return badRequest("Couldn't save those defaults.");
  return NextResponse.json({ ok: true });
}
