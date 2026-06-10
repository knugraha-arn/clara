"use client";

import { useState, useEffect, createContext, useContext } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

type Role = "viewer" | "auditor" | "contributor" | "admin" | "super_admin";

const RoleContext = createContext<Role>("viewer");
export const useRole = () => useContext(RoleContext);

interface NavItem {
  href: string;
  icon: string;
  label: string;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { href: "/dashboard",          icon: "📄", label: "Dokumen" },
  { href: "/dashboard/numbers",  icon: "📝", label: "Nomor Surat",   roles: ["auditor", "contributor", "admin", "super_admin"] },
  { href: "/dashboard/search",   icon: "🔍", label: "Pencarian" },
  { href: "/dashboard/register", icon: "📒", label: "Doc Register",  roles: ["auditor", "admin", "super_admin"] },
  { href: "/dashboard/audit",    icon: "📋", label: "Audit Trail",   roles: ["auditor", "admin", "super_admin"] },
  { href: "/dashboard/stats",    icon: "📊", label: "Statistik",     roles: ["admin", "super_admin"] },
  { href: "/dashboard/config",   icon: "⚙️", label: "Konfigurasi",   roles: ["super_admin"] },
];

const ROLE_LABELS: Record<Role, string> = {
  viewer:      "Viewer",
  auditor:     "Auditor",
  contributor: "Contributor",
  admin:       "Admin",
  super_admin: "Super Admin",
};

const ROLE_COLORS: Record<Role, string> = {
  viewer:      "#9CA3AF",
  auditor:     "#6B7280",
  contributor: "#0344D8",
  admin:       "#D97706",
  super_admin: "#DC2626",
};

interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: Role;
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(d => { if (d.profile) setProfile(d.profile); });
  }, []);

  const role = profile?.role || "viewer";
  const initials = (profile?.full_name || profile?.email || "U")
    .split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <RoleContext.Provider value={role}>
      <div style={{ display: "flex", height: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", backgroundColor: "#F8F9FB" }}>
        {/* Sidebar */}
        <div style={{ width: 220, backgroundColor: "#1A1F2E", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Logo */}
          <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Image src="/icon.png" alt="CLARA" width={32} height={32} style={{ borderRadius: 8 }} onError={() => {}} />
              <div>
                <p style={{ fontSize: 16, fontWeight: 800, color: "white", margin: 0, letterSpacing: "-0.3px" }}>CLARA</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: 0 }}>by Arranet</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
            {NAV.filter(item => !item.roles || item.roles.includes(role)).map(item => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, textDecoration: "none", marginBottom: 2, backgroundColor: active ? "#0344D8" : "transparent", color: active ? "white" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: active ? 600 : 400, transition: "all 0.15s" }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          {profile && (
            <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {profile.avatar_url ? (
                  <Image src={profile.avatar_url} alt={profile.full_name} width={32} height={32} style={{ borderRadius: "50%", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#0344D8", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {initials}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.full_name || profile.email}</p>
                  <span style={{ fontSize: 10, fontWeight: 600, color: ROLE_COLORS[role], backgroundColor: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: 4 }}>
                    {ROLE_LABELS[role]}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </RoleContext.Provider>
  );
}
