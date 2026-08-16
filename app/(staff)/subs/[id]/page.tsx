import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, money } from "@/lib/format";
import AccessCodeCard from "./AccessCodeCard";
import { revealCode } from "@/lib/accessCode";

export const dynamic = "force-dynamic";

export default async function SubDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const supabase = createClient();

  const { data: sub } = await supabase
    .from("subs")
    .select(
      "id, short_id, company_name, contact_name, email, phone, city, status, access_code_hash, access_code_enc, code_issued_at, sub_trades(trades(name))"
    )
    .eq("short_id", Number(params.id))
    .single();

  if (!sub) notFound();

  const { data: invitations } = await supabase
    .from("invitations")
    .select(
      "id, status, sent_at, viewed_at, bids(short_id, title, due_date, projects(name), trades(name)), responses(price)"
    )
    .eq("sub_id", sub.id)
    .order("sent_at", { ascending: false });

  const tradeNames = ((sub.sub_trades ?? []) as unknown as {
    trades: { name: string } | null;
  }[])
    .map((l) => l.trades?.name)
    .filter(Boolean) as string[];

  const facts = [
    ["Contact", sub.contact_name],
    ["Email", sub.email],
    ["Phone", sub.phone],
    ["City", sub.city],
  ] as const;

  return (
    <>
      <div className="pagehead">
        <h6 className="text-muted">
          <Link href="/subs" className="rowlink">
            Subs
          </Link>
        </h6>
        <h1 style={{ marginBottom: 6 }}>{sub.company_name}</h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span
            className={sub.status === "Active" ? "tag tag-accent" : "tag tag-neutral"}
          >
            {sub.status}
          </span>
          {tradeNames.map((t) => (
            <span key={t} className="tag tag-neutral">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div
        className="pagebody cols"
        style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 22 }}
      >
        <section style={{ minWidth: 0 }}>
          <h5>Bid history</h5>
          {(invitations ?? []).length === 0 ? (
            <p className="text-muted" style={{ fontSize: 14 }}>
              Nothing sent to this sub yet.
            </p>
          ) : (
            <div className="tablewrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Trade</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {(invitations ?? []).map((iv) => {
                    const bid = iv.bids as unknown as {
                      short_id: number;
                      title: string;
                      due_date: string | null;
                      projects: { name: string } | null;
                      trades: { name: string } | null;
                    } | null;
                    const response = iv.responses as unknown as
                      | { price: number | null }
                      | { price: number | null }[]
                      | null;
                    const price = Array.isArray(response)
                      ? response[0]?.price
                      : response?.price;

                    return (
                      <tr key={iv.id}>
                        <td>
                          <Link className="rowlink" href={`/bids/${bid?.short_id}`}>
                            {bid?.projects?.name ?? "—"}
                          </Link>
                        </td>
                        <td>{bid?.trades?.name ?? "—"}</td>
                        <td>{formatDate(bid?.due_date ?? null)}</td>
                        <td>
                          <span className="tag tag-neutral">{iv.status}</span>
                        </td>
                        <td>{price != null ? money(price) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div style={{ display: "grid", gap: 22, minWidth: 0 }}>
          <div className="card">
            <div className="card-kicker">Details</div>
            <dl style={{ margin: 0, display: "grid", gap: 10, fontSize: 14 }}>
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt
                    className="text-muted"
                    style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em" }}
                  >
                    {label}
                  </dt>
                  <dd style={{ margin: 0, wordBreak: "break-word" }}>{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          <AccessCodeCard
            shortId={sub.short_id}
            companyName={sub.company_name}
            issuedAt={sub.code_issued_at}
            hasCode={!!sub.access_code_hash}
            code={revealCode(sub.access_code_enc)}
            canWrite={canWrite(user)}
          />
        </div>
      </div>
    </>
  );
}
