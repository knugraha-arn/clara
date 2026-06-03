"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createContext, useContext } from "react";

interface UserProfile {
  name: string;
  email: string;
  avatar: string | null;
  role: string;
}

export const RoleContext = createContext<string>("auditor");
export const useRole = () => useContext(RoleContext);

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  auditor:     { label: "Auditor",     color: "#6B7280", bg: "#F3F4F6" },
  contributor: { label: "Contributor", color: "#0344D8", bg: "#EEF2FF" },
  admin:       { label: "Admin",       color: "#D97706", bg: "#FFFBEB" },
  super_admin: { label: "Super Admin", color: "#DC2626", bg: "#FEF2F2" },
};

const NAV = [
  { href: "/dashboard", icon: "📄", label: "Dokumen" },
  { href: "/dashboard/search", icon: "🔍", label: "Pencarian AI" },
  { href: "/dashboard/audit", icon: "📋", label: "Audit Trail", roles: ["super_admin", "admin", "auditor"] },
];

export default function DashboardShell({ children, profile }: { children: React.ReactNode; profile: UserProfile }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initials = profile.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const roleInfo = ROLE_LABELS[profile.role] || ROLE_LABELS.auditor;

  return (
    <RoleContext.Provider value={profile.role}>
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <aside style={{ width: 220, backgroundColor: "#1A1F2E", display: "flex", flexDirection: "column", flexShrink: 0, position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 40 }}>
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <Image src="/Logo Clara.png" alt="CLARA" width={32} height={32} style={{ borderRadius: 9 }} />
              <div>
                <p style={{ color: "white", fontWeight: 700, fontSize: 15, margin: 0, letterSpacing: "-0.3px" }}>CLARA</p>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, margin: 0 }}>by Arranet</p>
              </div>
            </Link>
          </div>

          <nav style={{ flex: 1, padding: "12px 10px" }}>
            {NAV.filter(item => !item.roles || item.roles.includes(profile.role)).map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, textDecoration: "none", marginBottom: 2, backgroundColor: active ? "#0344D8" : "transparent", color: active ? "white" : "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: active ? 600 : 400 }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ padding: "8px 12px", borderRadius: 10, marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
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
              <span style={{ backgroundColor: roleInfo.bg, color: roleInfo.color, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, display: "inline-block" }}>
                {roleInfo.label}
              </span>
            </div>
            <button onClick={handleSignOut}
              style={{ width: "100%", padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              Logout
            </button>
          </div>
        </aside>

        <main style={{ marginLeft: 220, flex: 1, backgroundColor: "#F8F9FB", minHeight: "100vh" }}>
          {children}
        </main>
      </div>
    </RoleContext.Provider>
  );
}
