"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Folder,
  FileText,
  Users,
  Hammer,
  Mail,
  Bell,
  UserCog,
  UserRound,
  Building2,
  Banknote,
  type LucideIcon,
} from "lucide-react";
import { APP, COMPANY, NAV, NAV_SETTINGS, ROLE_LABEL, type AppRole } from "@/app/config";
import { canSeePage } from "@/lib/access";
import { pageOfPath } from "@/lib/access";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  folder: Folder,
  "file-text": FileText,
  users: Users,
  hammer: Hammer,
  mail: Mail,
  bell: Bell,
  "user-cog": UserCog,
  "user-round": UserRound,
  "building-2": Building2,
  banknote: Banknote,
};

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  const Icon = ICONS[icon];
  return (
    <Link href={href} className="navlink" aria-current={active ? "page" : undefined}>
      {Icon ? <Icon /> : null}
      {label}
    </Link>
  );
}

export default function Sidebar({
  user,
}: {
  user: {
    name: string;
    email: string;
    appRole: AppRole;
    pageAccess: string[];
    companyName: string;
  };
}) {
  /** A link nobody can open shouldn't be in the menu at all. */
  const visible = (href: string) => {
    const page = pageOfPath(href);
    return !page || canSeePage(user, page);
  };
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="side">
      <div
        className="brand"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 14px 16px",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <Image
          src={APP.logo}
          alt={COMPANY.name}
          width={34}
          height={34}
          style={{ objectFit: "contain" }}
          priority
        />
        <div style={{ lineHeight: 1.05 }}>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 16,
              letterSpacing: ".02em",
            }}
          >
            {APP.brandLine1}
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
            }}
          >
            {APP.brandLine2}
          </div>
        </div>
      </div>

      <nav className="sidegroup" style={{ display: "flex", flexDirection: "column" }}>
        {NAV.filter((n) => visible(n.href)).map((n) => (
          <NavLink key={n.key} href={n.href} label={n.label} icon={n.icon} active={isActive(n.href)} />
        ))}
      </nav>

      <div className="sidegroup" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div className="sidelabel">Settings</div>
        {NAV_SETTINGS.filter((n) => visible(n.href)).map((n) => (
          <NavLink key={n.key} href={n.href} label={n.label} icon={n.icon} active={isActive(n.href)} />
        ))}
      </div>

      <div
        className="userbox"
        style={{
          marginTop: "auto",
          padding: "12px 14px 0",
          borderTop: "1px solid var(--color-divider)",
          fontSize: 12,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {user.name}
        </div>
        <div className="text-muted" style={{ fontSize: 11 }}>
          {ROLE_LABEL[user.appRole]} · {user.companyName}
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="btn btn-ghost"
            style={{ padding: 0, fontSize: 12, marginTop: 4 }}
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
