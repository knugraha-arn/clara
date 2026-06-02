import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CLARA — Correspondence & Library Archive Repository AI",
  description:
    "Sistem manajemen dokumen cerdas dengan AI Semantic Search, auto-kategorisasi, dan penomoran surat otomatis.",
  metadataBase: new URL("https://clara.arranetwork.com"),
  openGraph: {
    title: "CLARA",
    description: "Document Management System powered by AI",
    url: "https://clara.arranetwork.com",
    siteName: "CLARA",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={dmSans.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
