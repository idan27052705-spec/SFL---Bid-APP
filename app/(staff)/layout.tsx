import Sidebar from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="app">
      <Sidebar
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
          companyName: user.companyName,
        }}
      />
      <main style={{ minWidth: 0 }}>{children}</main>
    </div>
  );
}
