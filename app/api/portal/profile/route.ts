import { NextResponse } from "next/server";
import { getPortalSub } from "@/lib/portalSession";
import { createAdminClient } from "@/lib/supabase/admin";
import { STR, pickLang } from "@/lib/portalStrings";
import { wrongOrigin } from "@/lib/guard";

/**
 * POST /api/portal/profile — a sub asks to change one of their details.
 *
 * They can ask; they can't edit. Nothing on the sub record moves until
 * someone in the office approves it, which is why this writes a
 * change_request rather than touching `subs`.
 */
const ALLOWED = ["Company name", "Contact name", "Email", "Phone", "City"];

export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const sub = await getPortalSub();
  if (!sub) return NextResponse.json({ error: "Signed out." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const t = STR[pickLang(body?.lang)];

  const field = String(body?.field ?? "");
  const value = String(body?.value ?? "").trim();
  const note = String(body?.note ?? "").trim();

  if (!ALLOWED.includes(field))
    return NextResponse.json({ error: "That can't be changed here." }, { status: 400 });
  if (!value)
    return NextResponse.json({ error: "Enter the new value." }, { status: 400 });

  const admin = createAdminClient();

  const { error } = await admin.from("change_requests").insert({
    company_id: sub.company_id,
    sub_id: sub.id,
    field,
    value: value.slice(0, 200),
    note: note.slice(0, 300) || null,
    status: "Pending",
  });

  if (error)
    return NextResponse.json({ error: "Couldn't send that. Try again." }, { status: 400 });

  await admin.from("activity").insert({
    company_id: sub.company_id,
    type: "updated",
    text: `${sub.company_name} requested a profile change — ${field}`,
    meta: "awaiting approval",
  });

  return NextResponse.json({ ok: true, message: t.requestSent });
}
