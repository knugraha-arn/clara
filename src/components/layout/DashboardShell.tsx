"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface DashboardShellProps {
  children: React.ReactNode;
  profile: { name: string; email: string; avatar: string | null };
}

const NAV = [
  { href: "/dashboard", icon: "📄", label: "Dokumen" },
  { href: "/dashboard/search", icon: "🔍", label: "Pencarian AI" },
];

export default function DashboardShell({ children, profile }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initials = profile.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* SIDEBAR */}
      <aside style={{
        width: 220,
        backgroundColor: "#1A1F2E",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 40,
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <Image src="/Logo Clara.png" alt="CLARA" width={32} height={32} style={{ borderRadius: 9 }} />
            <div>
              <p style={{ color: "white", fontWeight: 700, fontSize: 15, margin: 0, letterSpacing: "-0.3px" }}>CLARA</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, margin: 0 }}>by Arranet</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px" }}>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 10,
                  textDecoration: "none",
                  marginBottom: 2,
                  backgroundColor: active ? "#0344D8" : "transparent",
                  color: active ? "white" : "rgba(255,255,255,0.5)",
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10 }}>
            {profile.avatar ? (
              <Image src={profile.avatar} alt={profile.name} width={30} height={30} style={{ borderRadius: "50%", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "#0344D8", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {initials}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "white", fontSize: 12, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name}</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            style={{ width: "100%", marginTop: 4, padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ marginLeft: 220, flex: 1, backgroundColor: "#F8F9FB", minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
