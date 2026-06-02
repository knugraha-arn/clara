import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8F9FB", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Image src="/Logo Clara.png" alt="CLARA" width={34} height={34} style={{ borderRadius: 10 }} />
          <span style={{ fontWeight: 700, color: "#1A1F2E", fontSize: 18, letterSpacing: "-0.3px" }}>CLARA</span>
        </div>
        <Link href="/login" style={{ backgroundColor: "#0344D8", color: "white", padding: "9px 22px", borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          Masuk
        </Link>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 40px 80px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, backgroundColor: "rgba(3,68,216,0.08)", color: "#0344D8", padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, marginBottom: 24 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#0344D8" }} />
          Powered by Gemini AI
        </div>

        <h1 style={{ fontSize: 52, fontWeight: 800, color: "#1A1F2E", lineHeight: 1.15, marginBottom: 20, letterSpacing: "-1px" }}>
          Kelola Arsip Dokumen<br />
          <span style={{ color: "#0344D8" }}>Lebih Cerdas</span>
        </h1>

        <p style={{ color: "#6B7280", fontSize: 18, lineHeight: 1.7, marginBottom: 36, maxWidth: 520 }}>
          Upload PDF, AI langsung membaca isi, mengkategorikan otomatis, dan temukan dokumen apapun hanya dengan mendeskripsikannya.
        </p>

        <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, backgroundColor: "#0344D8", color: "white", padding: "13px 28px", borderRadius: 14, fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
          Mulai Sekarang →
        </Link>

        {/* Features */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 56 }}>
          {[
            "📄  Upload PDF hingga 100MB",
            "🤖  Auto-kategorisasi AI",
            "🔍  Semantic Search",
            "🔐  Login Google OAuth",
            "⚡  Proses real-time",
          ].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "white", border: "1px solid #E5E7EB", borderRadius: 999, padding: "8px 16px", fontSize: 13, color: "#374151", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
              {f}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #E5E7EB", padding: "20px 40px", maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Image src="/arranet-logo-black.png" alt="Arranetwork" width={100} height={24} style={{ opacity: 0.35 }} />
        <p style={{ fontSize: 12, color: "#9CA3AF" }}>CLARA v2.0 · © 2026 Arranetwork</p>
      </footer>
    </div>
  );
}
