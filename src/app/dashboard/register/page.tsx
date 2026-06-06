"use client";

import { useState, useEffect } from "react";
import { useRole } from "@/components/layout/DashboardShell";
import type { MasterDocumentRegister } from "@/types";

const STATUS_CFG = {
  "Active":        { color: "#16A34A", bg: "#F0FDF4", label: "Aktif" },
  "Expiring Soon": { color: "#D97706", bg: "#FFFBEB", label: "Segera Expired" },
  "Expired":       { color: "#DC2626", bg: "#FEF2F2", label: "Expired" },
};

const CLS_CFG: Record<string, { color: string; bg: string }> = {
  Public:       { color: "#16A34A", bg: "#F0FDF4" },
  Internal:     { color: "#0344D8", bg: "#EEF2FF" },
  Confidential: { color: "#D97706", bg: "#FFFBEB" },
  Restricted:   { color: "#DC2626", bg: "#FEF2F2" },
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

export default function RegisterPage() {
  const role = useRole();
  const canExport = ["super_admin", "admin", "auditor"].includes(role);

  const [documents, setDocuments] = useState<MasterDocumentRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      const url = statusFilter === "all" ? "/api/register" : `/api/register?status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setDocuments(data.documents || []);
      setLoading(false);
    };
    fetch_();
  }, [statusFilter]);

  const handleExportCSV = () => {
    if (!documents.length) return;
    setExporting(true);

    const headers = ["No", "Judul Dokumen", "Nama File", "Kategori", "Klasifikasi", "Diupload Oleh", "Email", "Tanggal Upload", "Halaman", "Ukuran (KB)", "Retensi Sampai", "Status Retensi", "Ringkasan"];
    const rows = documents.map(d => [
      d.no_urut,
      `"${(d.judul_dokumen || "").replace(/"/g, '""')}"`,
      `"${(d.nama_file || "").replace(/"/g, '""')}"`,
      d.kategori,
      d.klasifikasi,
      `"${(d.diupload_oleh || "").replace(/"/g, '""')}"`,
      d.email_uploader,
      formatDate(d.tanggal_upload),
      d.jumlah_halaman || "",
      d.ukuran_kb,
      formatDate(d.retensi_sampai),
      d.status_retensi === "Active" ? "Aktif" : d.status_retensi === "Expiring Soon" ? "Segera Expired" : "Expired",
      `"${(d.ringkasan || "").replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CLARA_Master_Document_Register_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const expiringSoon = documents.filter(d => d.status_retensi === "Expiring Soon").length;
  const expired = documents.filter(d => d.status_retensi === "Expired").length;

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Master Document Register</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>Daftar lengkap semua arsip dokumen untuk keperluan audit</p>
        </div>
        {canExport && (
          <button onClick={handleExportCSV} disabled={exporting || !documents.length}
            style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#1A1F2E", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: exporting || !documents.length ? 0.5 : 1 }}>
            {exporting ? "⏳ Exporting..." : "⬇️ Export CSV"}
          </button>
        )}
      </div>

      <div style={{ padding: "20px 28px" }}>
        {/* Alert expiring */}
        {(expiringSoon > 0 || expired > 0) && (
          <div style={{ marginBottom: 16, display: "flex", gap: 10 }}>
            {expired > 0 && (
              <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔴</span>
                <span style={{ fontSize: 13, color: "#DC2626", fontWeight: 600 }}>{expired} dokumen sudah expired</span>
              </div>
            )}
            {expiringSoon > 0 && (
              <div style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ fontSize: 13, color: "#D97706", fontWeight: 600 }}>{expiringSoon} dokumen akan expired dalam 30 hari</span>
              </div>
            )}
          </div>
        )}

        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total Dokumen", value: documents.length, color: "#0344D8" },
            { label: "Segera Expired", value: expiringSoon, color: "#D97706" },
            { label: "Sudah Expired", value: expired, color: "#DC2626" },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 4px" }}>{s.label}</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
          {[
            { value: "all", label: "Semua" },
            { value: "active", label: "✅ Aktif" },
            { value: "expiring", label: "⚠️ Segera Expired" },
            { value: "expired", label: "🔴 Expired" },
          ].map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer", fontFamily: "inherit", backgroundColor: statusFilter === f.value ? "#1A1F2E" : "white", color: statusFilter === f.value ? "white" : "#6B7280", borderColor: statusFilter === f.value ? "#1A1F2E" : "#E5E7EB" }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 110px 110px 130px 90px 80px 110px 110px", gap: 10, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA", overflowX: "auto" }}>
            {["No", "Dokumen", "Klasifikasi", "Kategori", "Diupload Oleh", "Tgl Upload", "Ukuran", "Masa Berlaku", "Retensi s/d"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Memuat...</div>
          ) : documents.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <p style={{ fontSize: 32, margin: "0 0 8px" }}>📋</p>
              <p style={{ color: "#6B7280", fontWeight: 600, margin: 0 }}>Belum ada dokumen</p>
            </div>
          ) : (
            documents.map((doc, i) => {
              const statusCfg = STATUS_CFG[doc.status_retensi] || STATUS_CFG["Active"];
              const clsCfg = CLS_CFG[doc.klasifikasi] || CLS_CFG["Internal"];
              return (
                <div key={doc.id}
                  style={{ display: "grid", gridTemplateColumns: "40px 1fr 110px 110px 130px 90px 80px 110px 110px", gap: 10, padding: "12px 16px", borderBottom: i < documents.length - 1 ? "1px solid #F5F5F5" : "none", alignItems: "flex-start" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#FAFBFF"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                >
                  <span style={{ fontSize: 12, color: "#9CA3AF", paddingTop: 2 }}>{doc.no_urut}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1F2E", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.judul_dokumen}</p>
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.nama_file}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: clsCfg.bg, color: clsCfg.color, padding: "2px 7px", borderRadius: 4 }}>
                      {doc.klasifikasi}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: "#6B7280", paddingTop: 2 }}>{doc.kategori}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: "#374151", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.diupload_oleh || "—"}</p>
                  </div>
                  <span style={{ fontSize: 11, color: "#6B7280", paddingTop: 2 }}>{formatDate(doc.tanggal_upload)}</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF", paddingTop: 2 }}>{doc.ukuran_kb} KB</span>
                  <div>
                    {doc.masa_berlaku ? (
                      <>
                        <p style={{ fontSize: 11, color: "#374151", margin: "0 0 3px" }}>{formatDate(doc.masa_berlaku)}</p>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                          backgroundColor: doc.status_masa_berlaku === "Berakhir" ? "#FEF2F2" : doc.status_masa_berlaku === "Akan Berakhir" ? "#FFFBEB" : "#F0FDF4",
                          color: doc.status_masa_berlaku === "Berakhir" ? "#DC2626" : doc.status_masa_berlaku === "Akan Berakhir" ? "#D97706" : "#16A34A" }}>
                          {doc.status_masa_berlaku === "Berakhir" ? "⛔ Berakhir" : doc.status_masa_berlaku === "Akan Berakhir" ? "⚠️ Segera" : "✅ Aktif"}
                        </span>
                      </>
                    ) : (
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>—</p>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "#374151", margin: "0 0 3px" }}>{formatDate(doc.retensi_sampai)}</p>
                    <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: statusCfg.bg, color: statusCfg.color, padding: "1px 6px", borderRadius: 4 }}>
                      {statusCfg.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
