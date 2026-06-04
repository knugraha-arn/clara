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
    account_suspended: "Akun Anda telah disuspend. Hubungi administrator.",
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  };

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
    }}>
      {/* LEFT PANEL — dark */}
      <div style={{
        width: "38%",
        backgroundColor: "#1A1F2E",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "40px 44px",
        flexShrink: 0,
      }}>
        {/* Top: arranet logo */}
        <div>
          <Image
            src="/arranet-logo-black.png"
            alt="Arranetwork"
            width={90}
            height={22}
            style={{ filter: "brightness(0) invert(1)", opacity: 0.5 }}
          />
        </div>

        {/* Bottom: CLARA branding */}
        <div>
          <div style={{ marginBottom: 20 }}>
            <Image
              src="/Logo Clara.png"
              alt="CLARA"
              width={64}
              height={64}
              style={{ borderRadius: 18, marginBottom: 20 }}
            />
            <h1 style={{
              color: "white",
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: "-1px",
              margin: "0 0 10px",
              lineHeight: 1.1,
            }}>
              CLARA
            </h1>
            <p style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 13,
              lineHeight: 1.6,
              margin: "0 0 24px",
              maxWidth: 220,
            }}>
              Correspondence, Library Archive with Repository AI
            </p>
          </div>

          {/* Pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Arsip Dokumen", "AI Search", "Auto Kategori"].map((tag) => (
              <span key={tag} style={{
                backgroundColor: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 999,
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 500,
              }}>
                {tag}
              </span>
            ))}
          </div>

          <p style={{
            color: "rgba(255,255,255,0.2)",
            fontSize: 11,
            marginTop: 40,
          }}>
            CLARA · by Arranet · v2.0
          </p>
        </div>
      </div>

      {/* RIGHT PANEL — light */}
      <div style={{
        flex: 1,
        backgroundColor: "#F8F9FB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 60px",
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <h2 style={{
            fontSize: 26,
            fontWeight: 700,
            color: "#1A1F2E",
            margin: "0 0 8px",
            letterSpacing: "-0.5px",
          }}>
            Selamat datang
          </h2>
          <p style={{
            color: "#9CA3AF",
            fontSize: 14,
            marginBottom: 36,
            lineHeight: 1.5,
          }}>
            Masuk menggunakan akun Google Arranet kamu untuk melanjutkan.
          </p>

          {/* Error */}
          {error && (
            <div style={{
              backgroundColor: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#DC2626",
              fontSize: 13,
              borderRadius: 12,
              padding: "11px 16px",
              marginBottom: 16,
              textAlign: "center",
            }}>
              {errorMessages[error] ?? "Terjadi kesalahan"}
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              backgroundColor: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 16,
              padding: "15px 24px",
              fontSize: 15,
              fontWeight: 500,
              color: "#1A1F2E",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              fontFamily: "inherit",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              transition: "box-shadow 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#D1D5DB";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#E5E7EB";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? "Mengalihkan..." : "Masuk dengan Google"}
          </button>

          <p style={{
            textAlign: "center",
            fontSize: 12,
            color: "#9CA3AF",
            marginTop: 20,
            lineHeight: 1.5,
          }}>
            Hanya akun dengan domain <strong>@arranetwork.com</strong><br />
            yang dapat mengakses platform ini.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>;
}
