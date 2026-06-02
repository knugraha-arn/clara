"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";

export default function DashboardNav({ user }: { user: User }) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const avatarUrl = user.user_metadata?.avatar_url;
  const name = user.user_metadata?.full_name || user.email;

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0344D8] flex items-center justify-center">
            <span className="text-[#D1EA2C] font-bold text-sm">C</span>
          </div>
          <span className="font-bold text-[#1A1F2E] text-lg tracking-tight">CLARA</span>
        </div>

        {/* Nav Links */}
        <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-500">
          <a href="/dashboard" className="hover:text-[#0344D8] transition-colors">Dokumen</a>
          <a href="/dashboard/search" className="hover:text-[#0344D8] transition-colors">Pencarian</a>
        </div>

        {/* User */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-gray-600 truncate max-w-[160px]">{name}</span>
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={name || ""}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#0344D8] flex items-center justify-center text-white text-sm font-semibold">
              {(name || "U")[0].toUpperCase()}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            Keluar
          </button>
        </div>
      </div>
    </nav>
  );
}
