import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPortalSub } from "@/lib/portalSession";
import { createAdminClient } from "@/lib/supabase/admin";
import { STR, pickLang } from "@/lib/portalStrings";
import { formatDate, money } from "@/lib/format";
import PortalShell from "../PortalShell";

export const dynamic = "force-dynamic";

/** Days between today and the due date. Negative = overdue. */
function daysLeft(due: string | null) {
  if (!due) return null;
  const d = new Date(due + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export default async function PortalBidsPage() {
  const sub = await getPortalSub();
  if (!sub) redirect("/portal");

  const lang = pickLang(cookies().get("sfl_lang")?.value);
  const t = STR[lang];
  const admin = createAdminClient();

  // Service role bypasses RLS, so this MUST be scoped to the signed-in sub.
  const { data: invitations } = await admin
    .from("invitations")
    .select(
      "id, status, sent_at, bids(short_id, title, due_date, status, awarded_sub_id, projects(name, city), trades(name)), responses(price, submitted_at)"
    )
    .eq("sub_id", sub.id)
    .order("sent_at", { ascending: false });

  type Row = {
    id: string;
    status: string;
    bid: {
      short_id: number;
      title: string;
      due_date: string | null;
      status: string;
      awarded_sub_id: string | null;
      projects: { name: string; city: string | null } | null;
      trades: { name: string } | null;
    } | null;
    price: number | null;
  };

  const rows: Row[] = (invitations ?? []).map((iv) => {
    const r = iv.responses as unknown as { price: number | null }[] | { price: number | null } | null;
    return {
      id: iv.id,
      status: iv.status,
      bid: iv.bids as never,
      price: Array.isArray(r) ? (r[0]?.price ?? null) : (r?.price ?? null),
    };
  });

  const isClosed = (r: Row) =>
    r.bid?.status === "Awarded" || r.bid?.status === "Closed" || r.status === "Denied";

  const waiting = rows.filter((r) => !isClosed(r) && r.status !== "Received");
  const submitted = rows.filter((r) => !isClosed(r) && r.status === "Received");
  const past = rows.filter(isClosed);

  const Card = ({ r }: { r: Row }) => {
    const d = daysLeft(r.bid?.due_date ?? null);
    const won = r.bid?.awarded_sub_id === sub.id;

    const dueLabel =
      d == null
        ? ""
        : d < 0
          ? `${Math.abs(d)} ${t.overdue}`
          : d === 0
            ? t.today
            : d === 1
              ? t.tomorrow
              : `${d} ${t.inDays}`;

    return (
      <Link
        href={`/portal/bids/${r.bid?.short_id}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div className="card" style={{ gap: 6 }}>
          <div className="card-kicker">{r.bid?.trades?.name}</div>
          <div className="card-title">{r.bid?.projects?.name}</div>
          <div style={{ fontSize: 14 }}>{r.bid?.title}</div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              marginTop: 4,
            }}
          >
            {r.bid?.due_date && (
              <span
                className={d != null && d <= 1 ? "tag tag-outline" : "tag tag-neutral"}
              >
                {t.due} {formatDate(r.bid.due_date)}
                {dueLabel ? ` · ${dueLabel}` : ""}
              </span>
            )}
            {r.price != null && (
              <span className="tag tag-accent">
                {t.yourPrice}: {money(r.price)}
              </span>
            )}
            {won && <span className="tag tag-accent">{t.awarded}</span>}
            {r.status === "Denied" && (
              <span className="tag tag-neutral">{t.statusDenied}</span>
            )}
          </div>
        </div>
      </Link>
    );
  };

  const Section = ({
    title,
    items,
    empty,
  }: {
    title: string;
    items: Row[];
    empty: string;
  }) => (
    <section style={{ marginBottom: 26 }}>
      <h5 style={{ marginBottom: 10 }}>
        {title}
        {items.length > 0 && (
          <span className="text-muted" style={{ fontWeight: 400 }}>
            {" "}
            ({items.length})
          </span>
        )}
      </h5>
      {items.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 14 }}>
          {empty}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((r) => (
            <Card key={r.id} r={r} />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <PortalShell lang={lang} subName={sub.company_name}>
      <Section title={t.waiting} items={waiting} empty={t.nothingWaiting} />
      <Section title={t.submitted} items={submitted} empty={t.nothing} />
      {past.length > 0 && <Section title={t.past} items={past} empty={t.nothing} />}
    </PortalShell>
  );
}
