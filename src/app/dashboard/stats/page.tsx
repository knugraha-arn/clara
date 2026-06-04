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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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

// Simple bar chart component
function BarChart({ data, maxVal, color }: { data: { label: string; value: number }[]; maxVal: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map(item => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#6B7280", width: 100, flexShrink: 0, textAlign: "right" }}>{item.label}</span>
          <div style={{ flex: 1, height: 20, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%`, backgroundColor: color, borderRadius: 4, transition: "width 0.5s ease", display: "flex", alignItems: "center", paddingLeft: 6 }}>
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

  useEffect(() => {
    if (!canView) return;
    fetch("/api/stats").then(r => r.json()).then(d => { setStats(d); setLoading(false); });
  }, [canView]);

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
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Statistik</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>Data 30 hari terakhir</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, color: "#9CA3AF" }}>{today}</span>
          <Image src="/arranet-logo-black.png" alt="Arranetwork" width={90} height={22} style={{ opacity: 0.35 }} />
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

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Dokumen per Kategori */}
            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1F2E", margin: "0 0 16px" }}>Dokumen per Kategori</p>
              {Object.keys(stats.overview.byCategory).length === 0 ? (
                <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>Belum ada data</p>
              ) : (
                <BarChart
                  data={Object.entries(stats.overview.byCategory).map(([k, v]) => ({ label: CATEGORY_LABELS[k] || k, value: v }))}
                  maxVal={Math.max(...Object.values(stats.overview.byCategory))}
                  color="#0344D8"
                />
              )}
            </div>

            {/* Dokumen per Klasifikasi */}
            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1F2E", margin: "0 0 16px" }}>Dokumen per Klasifikasi</p>
              {Object.keys(stats.overview.byClassification).length === 0 ? (
                <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>Belum ada data</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Object.entries(stats.overview.byClassification).map(([cls, count]) => {
                    const cfg = CLS_CFG[cls] || CLS_CFG.internal;
                    const total = Object.values(stats.overview.byClassification).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={cls} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: cfg.bg, color: cfg.color, padding: "2px 8px", borderRadius: 4, width: 90, textAlign: "center", flexShrink: 0 }}>{cfg.label}</span>
                        <div style={{ flex: 1, height: 20, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, backgroundColor: cfg.color, borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 6, transition: "width 0.5s ease" }}>
                            {count > 0 && <span style={{ fontSize: 10, color: "white", fontWeight: 600 }}>{count}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0 }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Activity row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {/* Top Uploaders */}
            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1F2E", margin: "0 0 4px" }}>⬆️ Top Uploader</p>
              <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 16px" }}>30 hari terakhir</p>
              {stats.activity.topUploaders.length === 0 ? (
                <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>Belum ada aktivitas</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {stats.activity.topUploaders.map((u, i) => (
                    <div key={u.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "#D97706" : "#9CA3AF", width: 16, flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1F2E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0344D8", flexShrink: 0 }}>{u.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Downloaders */}
            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1F2E", margin: "0 0 4px" }}>⬇️ Top Download</p>
              <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 16px" }}>30 hari terakhir</p>
              {stats.activity.topDownloaders.length === 0 ? (
                <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>Belum ada aktivitas</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {stats.activity.topDownloaders.map((u, i) => (
                    <div key={u.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "#D97706" : "#9CA3AF", width: 16, flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1F2E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#16A34A", flexShrink: 0 }}>{u.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Dokumen */}
            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "20px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1F2E", margin: "0 0 4px" }}>🏆 Dokumen Terpopuler</p>
              <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 16px" }}>Paling sering didownload</p>
              {stats.activity.topDocuments.length === 0 ? (
                <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>Belum ada aktivitas</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {stats.activity.topDocuments.map((d, i) => (
                    <div key={d.title} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "#D97706" : "#9CA3AF", width: 16, flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1F2E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#9333EA", flexShrink: 0 }}>{d.count}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Security section */}
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
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 140px", gap: 12, padding: "10px 12px", borderBottom: i < stats.security.sensitiveAccess.length - 1 ? "1px solid #F5F5F5" : "none", alignItems: "center" }}>
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
