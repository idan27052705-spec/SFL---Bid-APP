import Sidebar from "@/components/Sidebar";
import { requirePageUser } from "@/lib/auth";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Wraps every staff page, so this is where access is decided — a page
  // can't forget to ask.
  const user = await requirePageUser();

  return (
    <div className="app">
      <Sidebar
        user={{
          name: user.name,
          email: user.email,
          appRole: user.appRole,
          pageAccess: user.pageAccess,
          companyName: user.companyName,
        }}
      />
      <main style={{ minWidth: 0 }}>{children}</main>
    </div>
  );
}
