"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { APP } from "@/app/config";
import { STR, type Lang } from "@/lib/portalStrings";

/**
 * Portal chrome. Wider and calmer than the staff app: a sub opens this
 * once every few weeks, so everything is a size bigger and there are
 * only two places to go.
 */
export type PortalCompany = { name: string; footer: string; phone: string };

export default function PortalShell({
  lang,
  subName,
  company,
  narrow = false,
  children,
}: {
  lang: Lang;
  subName?: string;
  /** The GC's own details, as saved in Settings > Company details. */
  company: PortalCompany;
  /** Reading-width column — used by the sign-in and My info pages. */
  narrow?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = STR[lang];

  const setLang = (next: Lang) => {
    document.cookie = `sfl_lang=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid var(--color-divider)",
          position: "sticky",
          top: 0,
          zIndex: 3,
          background: "var(--color-bg)",
        }}
      >
        <div
          className="phead"
          style={{
            width: "min(100%, 1080px)",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={subName ? "/portal/bids" : "/portal"}
            style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit" }}
          >
            <Image src={APP.logo} alt={company.name} width={52} height={52} priority />
            <div style={{ lineHeight: 1.1 }}>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 18,
                  letterSpacing: ".02em",
                  textTransform: "uppercase",
                }}
              >
                {company.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: ".16em",
                  textTransform: "uppercase",
                  color: "var(--color-accent-700)",
                }}
              >
                {t.portal}
              </div>
            </div>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            {subName && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Link
                  className="btn btn-ghost"
                  href="/portal/bids"
                  aria-current={pathname === "/portal/bids" ? "page" : undefined}
                >
                  {t.waiting}
                </Link>
                <Link
                  className="btn btn-ghost"
                  href="/portal/profile"
                  aria-current={pathname === "/portal/profile" ? "page" : undefined}
                >
                  {t.myInfo}
                </Link>
              </div>
            )}

            <div className="seg">
              <label className="seg-opt">
                <input
                  type="radio"
                  name="lang"
                  checked={lang === "en"}
                  onChange={() => setLang("en")}
                />
                EN
              </label>
              <label className="seg-opt">
                <input
                  type="radio"
                  name="lang"
                  checked={lang === "es"}
                  onChange={() => setLang("es")}
                />
                ES
              </label>
            </div>

            {subName && (
              <form action="/api/portal/logout" method="post">
                <button className="btn btn-secondary" type="submit">
                  {t.signOut}
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <div className={`pwrap${narrow ? " pwrap--narrow pwrap--tight" : ""}`}>
          {children}
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--color-divider)",
          fontSize: 12,
        }}
      >
        <div
          className="phead"
          style={{
            width: "min(100%, 1080px)",
            margin: "0 auto",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
          }}
        >
          <span>{company.footer}</span>
          <span style={{ marginLeft: "auto" }}>{APP.domain}/portal</span>
        </div>
      </footer>
    </div>
  );
}
