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
  const name = user.user_metadata?.full_name || user.email;
  const initials = (name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const navLinks = [
    { href: "/dashboard", label: "Dokumen" },
    { href: "/dashboard/search", label: "Pencarian AI" },
  ];

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <Image src="/Logo Clara.png" alt="CLARA" width={28} height={28} className="rounded-lg" />
          <span className="font-bold text-[#1A1F2E] text-base tracking-tight">CLARA</span>
        </Link>

        {/* Nav */}
        <div className="hidden sm:flex items-center gap-1 flex-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-[#0344D8]/8 text-[#0344D8]"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* User */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={name || ""} width={28} height={28} className="rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#0344D8] flex items-center justify-center text-white text-xs font-semibold">
                {initials}
              </div>
            )}
            <span className="text-sm text-gray-600 truncate max-w-[140px]">{name}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            Keluar
          </button>
        </div>
      </div>
    </nav>
  );
}
