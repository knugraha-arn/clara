import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CLARA",
  description: "Correspondence & Library Archive Repository AI",
  metadataBase: new URL("https://clara.arranetwork.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
