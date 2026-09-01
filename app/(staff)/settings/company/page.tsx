import { requireUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import CompanyForm from "./CompanyForm";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPage() {
  const user = await requireUser();
  const company = await getCompany(user.companyId);

  return (
    <>
      <div className="pagehead">
        <h6 className="text-muted">Settings</h6>
        <h1>Company details</h1>
        <p className="text-muted" style={{ maxWidth: 620 }}>
          This is how your company appears to every subcontractor — on the bid
          invitation emails, in the sub portal, and at the bottom of every
          message you send. Only the owner can change it.
        </p>
      </div>

      <div className="pagebody">
        <CompanyForm company={company} canEdit={user.appRole === "admin"} />
      </div>
    </>
  );
}
