"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#1A1F2E", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{ padding: "20px 32px" }}>
        <Image src="/arranet-logo-black.png" alt="Arranetwork" width={110} height={28} style={{ opacity: 0.4, filter: "brightness(0) invert(1)" }} />
      </div>

      {/* Center */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          {/* Logo + title */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <Image src="/Logo Clara.png" alt="CLARA" width={60} height={60} style={{ borderRadius: 18 }} />
            </div>
            <h1 style={{ color: "white", fontWeight: 700, fontSize: 24, letterSpacing: "-0.5px", margin: 0 }}>Masuk ke CLARA</h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              Correspondence & Library Archive Repository AI
            </p>
          </div>

          {/* Card */}
          <div style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Error */}
            {error && (
              <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5", fontSize: 13, borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
                {errorMessages[error] ?? "Terjadi kesalahan"}
              </div>
            )}

            {/* Domain badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(209,234,44,0.1)", border: "1px solid rgba(209,234,44,0.2)", borderRadius: 12, padding: "9px 14px" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#D1EA2C", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#D1EA2C" }}>Khusus akun <strong>@arranetwork.com</strong></span>
            </div>

            {/* Google button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "white", border: "none", borderRadius: 12, padding: "13px 20px", fontSize: 14, fontWeight: 600, color: "#1A1F2E", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? "Mengalihkan..." : "Lanjutkan dengan Google"}
            </button>
          </div>

          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 24 }}>
            © 2026 Arranetwork · CLARA v2.0
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>;
}
