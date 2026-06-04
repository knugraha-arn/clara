"use client";

import { useState, useEffect } from "react";
import { useRole } from "@/components/layout/DashboardShell";
import Image from "next/image";

const CATEGORY_LABELS: Record<string, string> = {
  surat_masuk: "Surat Masuk", surat_keluar: "Surat Keluar", kontrak: "Kontrak",
  memo: "Memo", laporan: "Laporan", kebijakan: "Kebijakan",
  undangan: "Undangan", pengumuman: "Pengumuman", lainnya: "Lainnya",
};

const CLS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  public:       { label: "Public",       color: "#16A34A", bg: "#F0FDF4" },
  internal:     { label: "Internal",     color: "#0344D8", bg: "#EEF2FF" },
  confidential: { label: "Confidential", color: "#D97706", bg: "#FFFBEB" },
  restricted:   { label: "Restricted",   color: "#DC2626", bg: "#FEF2F2" },
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

function formatDateTime(d: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

interface StatsData {
  overview: {
    totalDocs: number;
    totalSizeBytes: number;
    totalScanned: number;
    expiringCount: number;
    byCategory: Record<string, number>;
    byClassification: Record<string, number>;
    uploadByMonth: Record<string, number>;
  };
  activity: {
    topUploaders: { name: string; count: number }[];
    topDownloaders: { name: string; count: number }[];
    topDocuments: { title: string; count: number }[];
    activityByDay: Record<string, { upload: number; download: number }>;
  };
  security: {
    sensitiveAccess: { user: string; document: string; classification: unknown; time: string }[];
  };
}

async function generatePDFReport(stats: StatsData) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());

  // Header
  doc.setFillColor(3, 68, 216);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("CLARA — Laporan Statistik Arsip Dokumen", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Digenerate: " + now + "  |  CONFIDENTIAL — Arranetwork Internal", 14, 18);

  // Overview table
  doc.setTextColor(26, 31, 46);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Overview Arsip", 14, 30);

  autoTable(doc, {
    startY: 34,
    head: [["Metrik", "Nilai"]],
    body: [
      ["Total Dokumen", String(stats.overview.totalDocs)],
      ["Total Storage", formatSize(stats.overview.totalSizeBytes)],
      ["Dokumen Scan", String(stats.overview.totalScanned)],
      ["Segera Expired (30 hari)", String(stats.overview.expiringCount)],
    ],
    theme: "grid",
    headStyles: { fillColor: [3, 68, 216], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 80 } },
    margin: { left: 14 },
    tableWidth: 120,
  });

  // Kategori
  const afterOverview = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Dokumen per Kategori", 14, afterOverview);

  autoTable(doc, {
    startY: afterOverview + 4,
    head: [["Kategori", "Jumlah"]],
    body: Object.entries(stats.overview.byCategory).map(([k, v]) => [CATEGORY_LABELS[k] || k, String(v)]),
    theme: "grid",
    headStyles: { fillColor: [3, 68, 216], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 80 } },
    margin: { left: 14 },
    tableWidth: 120,
  });

  // Klasifikasi (kanan atas)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(26, 31, 46);
  doc.text("Dokumen per Klasifikasi", 150, 30);

  autoTable(doc, {
    startY: 34,
    head: [["Klasifikasi", "Jumlah"]],
    body: Object.entries(stats.overview.byClassification).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), String(v)]),
    theme: "grid",
    headStyles: { fillColor: [3, 68, 216], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9 },
    margin: { left: 150 },
    tableWidth: 120,
  });

  // Page 2 — Activity
  doc.addPage();
  doc.setFillColor(3, 68, 216);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Aktivitas User — 30 Hari Terakhir", 14, 14);

  doc.setTextColor(26, 31, 46);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Top Uploader", 14, 30);

  autoTable(doc, {
    startY: 34,
    head: [["#", "User", "Jumlah Upload"]],
    body: stats.activity.topUploaders.length > 0
      ? stats.activity.topUploaders.map((u, i) => [String(i + 1), u.name, String(u.count)])
      : [["—", "Belum ada aktivitas", "0"]],
    theme: "grid",
    headStyles: { fillColor: [3, 68, 216], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9 },
    margin: { left: 14 },
    tableWidth: 120,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Top Downloader", 150, 30);

  autoTable(doc, {
    startY: 34,
    head: [["#", "User", "Jumlah Download"]],
    body: stats.activity.topDownloaders.length > 0
      ? stats.activity.topDownloaders.map((u, i) => [String(i + 1), u.name, String(u.count)])
      : [["—", "Belum ada aktivitas", "0"]],
    theme: "grid",
    headStyles: { fillColor: [3, 68, 216], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9 },
    margin: { left: 150 },
    tableWidth: 120,
  });

  const actY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (stats.security.sensitiveAccess.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(26, 31, 46);
    doc.text("Akses Dokumen Sensitif (Confidential & Restricted)", 14, actY);

    autoTable(doc, {
      startY: actY + 4,
      head: [["User", "Dokumen", "Klasifikasi", "Waktu"]],
      body: stats.security.sensitiveAccess.map(s => [
        s.user, s.document, String(s.classification || ""),
        formatDateTime(s.time),
      ]),
      theme: "grid",
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 8 },
      margin: { left: 14 },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      "Halaman " + i + " dari " + pageCount + "  |  CLARA Document Management System  |  Arranetwork © " + new Date().getFullYear(),
      14, doc.internal.pageSize.getHeight() - 6
    );
  }

  doc.save("CLARA_Statistik_" + new Date().toISOString().split("T")[0] + ".pdf");
}

function BarChart({ data, maxVal, color }: { data: { label: string; value: number }[]; maxVal: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map(item => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#6B7280", width: 100, flexShrink: 0, textAlign: "right" }}>{item.label}</span>
          <div style={{ flex: 1, height: 20, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: maxVal > 0 ? ((item.value / maxVal) * 100) + "%" : "0%", backgroundColor: color, borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 6 }}>
              {item.value > 0 && <span style={{ fontSize: 10, color: "white", fontWeight: 600 }}>{item.value}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StatsPage() {
  const role = useRole();
  const canView = ["super_admin", "admin"].includes(role);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    if (!canView) return;
    fetch("/api/stats").then(r => r.json()).then(d => { setStats(d); setLoading(false); });
  }, [canView]);

  const handleDownloadPDF = async () => {
    if (!stats) return;
    setGeneratingPDF(true);
    try { await generatePDFReport(stats); }
    finally { setGeneratingPDF(false); }
  };

  if (!canView) {
    return (
      <div style={{ padding: "40px 28px", textAlign: "center", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔒</p>
        <p style={{ fontWeight: 600, color: "#6B7280" }}>Akses ditolak</p>
      </div>
    );
  }

  const today = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Statistik</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>Data 30 hari terakhir</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#9CA3AF" }}>{today}</span>
          <Image src="/arranet-logo-black.png" alt="Arranetwork" width={90} height={22} style={{ opacity: 0.35 }} />
          <button onClick={handleDownloadPDF} disabled={!stats || generatingPDF}
            style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#DC2626", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: !stats || generatingPDF ? 0.5 : 1 }}>
            {generatingPDF ? "⏳ Generating..." : "📄 Download PDF"}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "#9CA3AF" }}>Memuat statistik...</div>
      ) : stats ? (
        <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Overview cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Total Dokumen", value: stats.overview.totalDocs, sub: "dokumen tersimpan", color: "#0344D8", icon: "📄" },
              { label: "Total Storage", value: formatSize(stats.overview.totalSizeBytes), sub: "kapasitas terpakai", color: "#16A34A", icon: "💾" },
              { label: "Dokumen Scan", value: stats.overview.totalScanned, sub: "analisis terbatas", color: "#D97706", icon: "📷" },
              { label: "Segera Expired", value: stats.overview.expiringCount, sub: "dalam 30 hari", color: "#DC2626", icon: "⏰" },
            ].map(card => (
              <div key={card.label} style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 12, padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{card.icon}</span>
                  <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>{card.label}</p>
                </div>
                <p style={{ fontSize: 26, fontWeight: 700, color: card.color, margin: "0 0 2px" }}>{card.value}</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1F2E", margin: "0 0 16px" }}>Dokumen per Kategori</p>
              {Object.keys(stats.overview.byCategory).length === 0
                ? <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>Belum ada data</p>
                : <BarChart data={Object.entries(stats.overview.byCategory).map(([k, v]) => ({ label: CATEGORY_LABELS[k] || k, value: v }))} maxVal={Math.max(...Object.values(stats.overview.byCategory))} color="#0344D8" />}
            </div>
            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1F2E", margin: "0 0 16px" }}>Dokumen per Klasifikasi</p>
              {Object.keys(stats.overview.byClassification).length === 0
                ? <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>Belum ada data</p>
                : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Object.entries(stats.overview.byClassification).map(([cls, count]) => {
                    const cfg = CLS_CFG[cls] || CLS_CFG.internal;
                    const total = Object.values(stats.overview.byClassification).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={cls} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: cfg.bg, color: cfg.color, padding: "2px 8px", borderRadius: 4, width: 90, textAlign: "center", flexShrink: 0 }}>{cfg.label}</span>
                        <div style={{ flex: 1, height: 20, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: pct + "%", backgroundColor: cfg.color, borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 6 }}>
                            {count > 0 && <span style={{ fontSize: 10, color: "white", fontWeight: 600 }}>{count}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0 }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>}
            </div>
          </div>

          {/* Activity */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              { title: "⬆️ Top Uploader", data: stats.activity.topUploaders, color: "#0344D8" },
              { title: "⬇️ Top Download", data: stats.activity.topDownloaders, color: "#16A34A" },
              { title: "🏆 Dokumen Terpopuler", data: stats.activity.topDocuments, color: "#9333EA" },
            ].map(section => (
              <div key={section.title} style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "20px" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1F2E", margin: "0 0 4px" }}>{section.title}</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 16px" }}>30 hari terakhir</p>
                {section.data.length === 0
                  ? <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>Belum ada aktivitas</p>
                  : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {section.data.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "#D97706" : "#9CA3AF", width: 16, flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1F2E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {"name" in item ? item.name : item.title}
                          </p>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: section.color, flexShrink: 0 }}>
                          {item.count}{"title" in item ? "x" : ""}
                        </span>
                      </div>
                    ))}
                  </div>}
              </div>
            ))}
          </div>

          {/* Security */}
          <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "20px" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1F2E", margin: "0 0 4px" }}>🔒 Akses Dokumen Sensitif</p>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 16px" }}>Download dokumen Confidential & Restricted — 30 hari terakhir</p>
            {stats.security.sensitiveAccess.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ fontSize: 24, margin: "0 0 6px" }}>✅</p>
                <p style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>Tidak ada akses dokumen sensitif yang perlu diperhatikan</p>
              </div>
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 140px", gap: 12, padding: "8px 12px", backgroundColor: "#FAFAFA", borderRadius: 8, marginBottom: 4 }}>
                  {["User", "Dokumen", "Klasifikasi", "Waktu"].map(h => (
                    <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                  ))}
                </div>
                {stats.security.sensitiveAccess.map((item, i) => {
                  const cls = String(item.classification || "");
                  const clsCfg = CLS_CFG[cls] || CLS_CFG.confidential;
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 140px", gap: 12, padding: "10px 12px", borderBottom: i < stats.security.sensitiveAccess.length - 1 ? "1px solid #F5F5F5" : "none", alignItems: "center" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#FAFBFF"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}>
                      <span style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.user}</span>
                      <span style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.document}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: clsCfg.bg, color: clsCfg.color, padding: "2px 7px", borderRadius: 4, display: "inline-block" }}>{clsCfg.label}</span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{formatDateTime(item.time)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
