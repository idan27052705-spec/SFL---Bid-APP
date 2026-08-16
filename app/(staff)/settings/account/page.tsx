import { requireUser } from "@/lib/auth";
import AccountForm from "./AccountForm";

export default async function AccountSettingsPage() {
  const user = await requireUser();

  return (
    <>
      <div className="pagehead">
        <h6 className="text-muted">Settings</h6>
        <h1>My account</h1>
        <p className="text-muted" style={{ maxWidth: 560 }}>
          Your own name, sign-in email and password. Everyone manages their own
          account here — nobody can change someone else&apos;s from this page.
        </p>
      </div>

      <div className="pagebody">
        <AccountForm
          name={user.name}
          email={user.email}
          role={user.role}
          companyName={user.companyName}
        />
      </div>
    </>
  );
}
