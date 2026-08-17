import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPortalSub } from "@/lib/portalSession";
import { pickLang } from "@/lib/portalStrings";
import PortalShell from "./PortalShell";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: { expired?: string; email?: string };
}) {
  const sub = await getPortalSub();
  if (sub) redirect("/portal/bids");

  const lang = pickLang(cookies().get("sfl_lang")?.value);

  return (
    <PortalShell lang={lang} narrow>
      <LoginForm lang={lang} expired={searchParams.expired === "1"} email={searchParams.email} />
    </PortalShell>
  );
}
