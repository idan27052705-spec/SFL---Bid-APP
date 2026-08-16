"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { APP, COMPANY } from "@/app/config";
import { STR, type Lang } from "@/lib/portalStrings";

/**
 * Portal chrome. Mobile first: one column, big touch targets, nothing
 * clever. A sub opens this on a phone, in a truck, in the sun.
 */
export default function PortalShell({
  lang,
  subName,
  children,
}: {
  lang: Lang;
  subName?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const t = STR[lang];

  const setLang = (next: Lang) => {
    document.cookie = `sfl_lang=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderBottom: "1px solid var(--color-divider)",
          position: "sticky",
          top: 0,
          background: "var(--color-bg)",
          zIndex: 10,
        }}
      >
        <Link href="/portal/bids" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <Image src={APP.logo} alt={COMPANY.name} width={30} height={30} priority />
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15 }}>
              {COMPANY.name}
            </div>
            <div
              className="text-muted"
              style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase" }}
            >
              {t.portal}
            </div>
          </div>
        </Link>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "4px 6px", opacity: lang === "en" ? 1 : 0.5 }}
            onClick={() => setLang("en")}
          >
            EN
          </button>
          <span className="text-muted">·</span>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "4px 6px", opacity: lang === "es" ? 1 : 0.5 }}
            onClick={() => setLang("es")}
          >
            ES
          </button>
        </div>
      </header>

      <main style={{ flex: 1, width: "100%", maxWidth: 640, margin: "0 auto", padding: "18px 16px 40px" }}>
        {children}
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--color-divider)",
          padding: "14px 16px",
          fontSize: 12,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span className="text-muted">
          {subName ? `${subName} · ` : ""}
          {COMPANY.phone}
        </span>
        {subName && (
          <form action="/api/portal/logout" method="post" style={{ marginLeft: "auto" }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: 0 }} type="submit">
              {t.signOut}
            </button>
          </form>
        )}
      </footer>
    </div>
  );
}
