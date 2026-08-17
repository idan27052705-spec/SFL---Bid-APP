import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPortalSub } from "@/lib/portalSession";
import { pickLang } from "@/lib/portalStrings";
import { getCompany, companyFooter } from "@/lib/company";
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

  const company = await getCompany();
  const shell = { name: company.name, footer: companyFooter(company), phone: company.phone };

  return (
    <PortalShell company={shell} lang={lang} narrow>
      <LoginForm phone={company.phone} lang={lang} expired={searchParams.expired === "1"} email={searchParams.email} />
    </PortalShell>
  );
}
