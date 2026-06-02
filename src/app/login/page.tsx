"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    domain_not_allowed: "Akses hanya untuk email @arranetwork.com",
    auth_callback_failed: "Login gagal, coba lagi",
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#1A1F2E] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5">
        <Image src="/arranet-logo-black.png" alt="Arranetwork" width={120} height={32} className="brightness-0 invert opacity-60" />
      </div>

      {/* Center content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo & title */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Image src="/Logo Clara.png" alt="CLARA" width={56} height={56} className="rounded-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Masuk ke CLARA</h1>
              <p className="text-sm text-gray-400 mt-1">Correspondence & Library Archive Repository AI</p>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 text-center">
                {errorMessages[error] ?? "Terjadi kesalahan, coba lagi"}
              </div>
            )}

            {/* Domain notice */}
            <div className="flex items-center gap-2 bg-[#D1EA2C]/10 border border-[#D1EA2C]/20 rounded-xl px-4 py-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#D1EA2C] shrink-0" />
              <p className="text-xs text-[#D1EA2C]">Khusus akun <span className="font-semibold">@arranetwork.com</span></p>
            </div>

            {/* Google button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 px-5 py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? "Mengalihkan..." : "Lanjutkan dengan Google"}
            </button>
          </div>

          <p className="text-center text-xs text-gray-600">
            © 2026 Arranetwork · CLARA v2.0
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
