import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrecastFlow | From Shop Drawing to Jobsite",
  description:
    "QR production passports, quality inspections, and traceability for precast manufacturing.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
