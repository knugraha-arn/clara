"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";

export default function DashboardNav({ user }: { user: User }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const avatarUrl = user.user_metadata?.avatar_url;
  const name = user.user_metadata?.full_name || user.email || "User";
  const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const navLinks = [
    { href: "/dashboard", label: "Dokumen" },
    { href: "/dashboard/search", label: "Pencarian AI" },
  ];

  return (
    <nav style={{ backgroundColor: "white", borderBottom: "1px solid #F0F0F0", position: "sticky", top: 0, zIndex: 50, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        {/* Logo */}
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
          <Image src="/Logo Clara.png" alt="CLARA" width={30} height={30} style={{ borderRadius: 8 }} />
          <span style={{ fontWeight: 700, color: "#1A1F2E", fontSize: 16, letterSpacing: "-0.3px" }}>CLARA</span>
        </Link>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: "6px 14px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                transition: "all 0.15s",
                backgroundColor: pathname === link.href ? "rgba(3,68,216,0.08)" : "transparent",
                color: pathname === link.href ? "#0344D8" : "#6B7280",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* User */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: "#6B7280", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          {avatarUrl ? (
            <Image src={avatarUrl} alt={name} width={30} height={30} style={{ borderRadius: "50%" }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "#0344D8", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700 }}>
              {initials}
            </div>
          )}
          <button
            onClick={handleSignOut}
            style={{ fontSize: 12, color: "#9CA3AF", border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 12px", backgroundColor: "transparent", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            Keluar
          </button>
        </div>
      </div>
    </nav>
  );
}
