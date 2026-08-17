import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser, forbidden, badRequest, notFound } from "@/lib/api";
import { sendEmail, renderTemplate } from "@/lib/email";
import { money } from "@/lib/format";
import { getCompany } from "@/lib/company";
import { wrongOrigin } from "@/lib/guard";

/**
 * POST /api/bids/:shortId/award — give the package to one sub.
 *
 * Awarding is the point of no return: the package freezes, every
 * reminder on it stops, and the winner is emailed. Only owners and staff
 * can do it.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const bad = wrongOrigin();
  if (bad) return bad;

  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const company = await getCompany(user.companyId);

  if (user.role === "viewer") return forbidden();

  const body = await request.json().catch(() => null);
  const subId = String(body?.subId ?? "");
  if (!subId) return badRequest("Pick a sub to award to.");

  const supabase = createClient();

  const { data: bid } = await supabase
    .from("bids")
    .select("id, short_id, title, status, project_id, projects(name), trades(name)")
    .eq("short_id", Number(params.id))
    .single();

  if (!bid) return notFound("Bid not found.");
  if (bid.status === "Awarded")
    return badRequest("This package has already been awarded.");

  // The winner must have actually priced it.
  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, subs(id, company_name, contact_name, email), responses(price)")
    .eq("bid_id", bid.id)
    .eq("sub_id", subId)
    .single();

  if (!invitation) return badRequest("That sub wasn't invited to this package.");

  const sub = invitation.subs as unknown as {
    id: string;
    company_name: string;
    contact_name: string | null;
    email: string | null;
  };
  const r = invitation.responses as unknown as
    | { price: number | null }[]
    | { price: number | null }
    | null;
  const price = Array.isArray(r) ? r[0]?.price : r?.price;

  if (price == null)
    return badRequest(`${sub.company_name} hasn't sent a price yet.`);

  const { error } = await supabase
    .from("bids")
    .update({
      awarded_sub_id: sub.id,
      awarded_at: new Date().toISOString(),
      status: "Awarded",
      cadence: "Stopped",
    })
    .eq("id", bid.id);

  if (error) return badRequest("Couldn't award the package. Try again.");

  const trade = bid.trades as unknown as { name: string } | null;
  const project = bid.projects as unknown as { name: string } | null;

  // Tell the winner. A failed email doesn't undo the award — the record
  // is what matters — but it is reported back so the office can call.
  let emailed = false;
  if (sub.email) {
    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("kind", "award")
      .single();

    if (template) {
      const fields = {
        contact: sub.contact_name || sub.company_name,
        sub_company: sub.company_name,
        company_name: company.name,
        company_phone: company.phone,
        project: project?.name ?? "",
        trade: trade?.name ?? "",
        bid_title: bid.title,
        price: money(price),
      };
      const result = await sendEmail({
      companyId: user.companyId,
        to: sub.email,
        subject: renderTemplate(template.subject, fields),
        text: renderTemplate(template.body, fields),
      });
      emailed = result.ok;
    }
  }

  await supabase.from("activity").insert([
    {
      company_id: user.companyId,
      type: "awarded",
      text: `${trade?.name ?? "Package"} awarded to ${sub.company_name}`,
      meta: `${money(price)} · ${user.name}`,
      project_id: bid.project_id,
      bid_id: bid.id,
      actor_id: user.id,
    },
    {
      company_id: user.companyId,
      type: "updated",
      text: `Reminders stopped for every sub on ${trade?.name ?? "this package"} — awarded`,
      meta: "automatic",
      project_id: bid.project_id,
      bid_id: bid.id,
      actor_id: user.id,
    },
  ]);

  return NextResponse.json({ ok: true, company: sub.company_name, emailed });
}
