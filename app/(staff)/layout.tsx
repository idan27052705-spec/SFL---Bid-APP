import Sidebar from "@/components/Sidebar";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app">
      <Sidebar />
      <main style={{ minWidth: 0 }}>{children}</main>
    </div>
  );
}
