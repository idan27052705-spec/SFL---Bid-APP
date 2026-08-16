import type { Metadata } from "next";
import { APP, COMPANY } from "./config";
import "./globals.css";

export const metadata: Metadata = {
  title: APP.name,
  description: `Bid management for ${COMPANY.name} — ${COMPANY.region}.`,
  icons: { icon: APP.logo },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
