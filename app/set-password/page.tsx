import Image from "next/image";
import { APP, COMPANY } from "@/app/config";
import SetPasswordForm from "./SetPasswordForm";

export const metadata = { title: "Set your password" };

export default function SetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "min(400px, 100%)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Image src={APP.logo} alt={COMPANY.name} width={38} height={38} priority />
          <div style={{ lineHeight: 1.05 }}>
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: 18,
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

        <SetPasswordForm token={searchParams.token ?? ""} />
      </div>
    </div>
  );
}
