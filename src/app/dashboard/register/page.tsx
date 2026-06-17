"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "@/components/layout/DashboardShell";
import { CATEGORY_LABELS, formatDateShort } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { SkeletonPage } from "@/components/ui/Skeleton";
import type { MasterDocumentRegister, DocumentCategory } from "@/types";

const formatDate = formatDateShort;

interface ValidityDoc {
  id: string;
  title: string;
  category: string;
  classification: string;
  valid_until: string;
  uploader_name: string;
  parties: string;
  days_remaining: number;
  status: "aktif" | "segera" | "berakhir";
}

const STATUS_CFG = {
  "Active":        { color: "#16A34A", bg: "#F0FDF4", label: "Aktif" },
  "Expiring Soon": { color: "#D97706", bg: "#FFFBEB", label: "Segera Expired" },
  "Expired":       { color: "#DC2626", bg: "#FEF2F2", label: "Expired" },
};

// Key kapitalized karena data klasifikasi dari DB sudah dalam bentuk "Public", "Internal", dll
const CLS_CFG: Record<string, { color: string; bg: string }> = {
  Public:       { color: "#16A34A", bg: "#F0FDF4" },
  Internal:     { color: "#0344D8", bg: "#EEF2FF" },
  Confidential: { color: "#D97706", bg: "#FFFBEB" },
  Restricted:   { color: "#DC2626", bg: "#FEF2F2" },
};

function daysRemaining(d: string) {
  const diff = Math.ceil((new Date(d).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function RegisterPage() {
  const role = useRole();
  const canExport = ["super_admin", "admin", "auditor"].includes(role);
  const isAdmin = ["super_admin", "admin"].includes(role);
  const { error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<"arsip" | "masa_berlaku">("arsip");

  // Arsip tab state
  const [documents, setDocuments] = useState<MasterDocumentRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  // Masa Berlaku tab state
  const [validityDocs, setValidityDocs] = useState<ValidityDoc[]>([]);
  const [validityLoading, setValidityLoading] = useState(false);
  const [validitySearch, setValiditySearch] = useState("");
  const [validityFilter, setValidityFilter] = useState<"all" | "30" | "90" | "custom">("all");
  const [showExpired, setShowExpired] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Fetch arsip
  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const url = statusFilter === "all" ? "/api/register" : `/api/register?status=${statusFilter}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setDocuments(data.documents || []);
      } catch {
        toastError("Gagal memuat data register.");
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, [statusFilter, toastError]);

  // Fetch masa berlaku
  const fetchValidity = useCallback(async () => {
    setValidityLoading(true);
    try {
      const res = await fetch("/api/register/validity");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setValidityDocs(json.data || []);
    } catch {
      toastError("Gagal memuat data masa berlaku.");
    } finally {
      setValidityLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    if (activeTab === "masa_berlaku") fetchValidity();
  }, [activeTab, fetchValidity]);

  // Filter validity docs
  const filteredValidity = validityDocs.filter(d => {
    const days = daysRemaining(d.valid_until);
    const isExpired = days < 0;

    if (!showExpired && isExpired) return false;
    if (validityFilter === "30" && days > 30) return false;
    if (validityFilter === "90" && days > 90) return false;
    if (validityFilter === "custom") {
      const expDate = new Date(d.valid_until);
      if (customFrom && expDate < new Date(customFrom)) return false;
      if (customTo && expDate > new Date(customTo)) return false;
    }

    if (validitySearch.trim()) {
      const q = validitySearch.toLowerCase();
      return d.title.toLowerCase().includes(q) || d.parties.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    const da = daysRemaining(a.valid_until);
    const db = daysRemaining(b.valid_until);
    return da - db;
  });

  // Export validity CSV
  const handleExportValidity = () => {
    if (!filteredValidity.length) return;
    const headers = ["Judul Dokumen", "Pihak", "Kategori", "Klasifikasi", "Masa Berlaku", "Sisa Hari", "Status", "Uploader"];
    const rows = filteredValidity.map(d => {
      const days = daysRemaining(d.valid_until);
      return [
        `"${d.title.replace(/"/g, '""')}"`,
        `"${d.parties.replace(/"/g, '""')}"`,
        CATEGORY_LABELS[d.category as DocumentCategory] || d.category,
        d.classification,
        formatDate(d.valid_until),
        days < 0 ? "Sudah berakhir" : `${days} hari`,
        days < 0 ? "Berakhir" : days <= 30 ? "Segera" : "Aktif",
        d.uploader_name,
      ];
    });
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CLARA_MasaBerlaku_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export arsip CSV
  const handleExportArsip = () => {
    if (!documents.length) return;
    const headers = ["No", "Judul Dokumen", "Nama File", "Kategori", "Klasifikasi", "Diupload Oleh", "Tanggal Upload", "Halaman", "Ukuran (KB)", "Masa Berlaku", "Retensi Sampai", "Status Retensi", "Ringkasan"];
    const rows = documents.map(d => [
      d.no_urut,
      `"${(d.judul_dokumen || "").replace(/"/g, '""')}"`,
      `"${(d.nama_file || "").replace(/"/g, '""')}"`,
      d.kategori,
      d.klasifikasi,
      `"${(d.diupload_oleh || "").replace(/"/g, '""')}"`,
      formatDate(d.tanggal_upload),
      d.jumlah_halaman || "",
      d.ukuran_kb,
      formatDate((d as unknown as Record<string, string>).masa_berlaku || null),
      formatDate(d.retensi_sampai),
      d.status_retensi === "Active" ? "Aktif" : d.status_retensi === "Expiring Soon" ? "Segera Expired" : "Expired",
      `"${(d.ringkasan || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CLARA_MasterRegister_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const expiringCount = validityDocs.filter(d => { const days = daysRemaining(d.valid_until); return days >= 0 && days <= 30; }).length;
  const expiredCount = validityDocs.filter(d => daysRemaining(d.valid_until) < 0).length;

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Master Document Register</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>Daftar lengkap arsip dokumen untuk keperluan audit</p>
        </div>
        {canExport && (
          <button onClick={activeTab === "arsip" ? handleExportArsip : handleExportValidity}
            disabled={activeTab === "arsip" ? !documents.length : !filteredValidity.length}
            style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#1A1F2E", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            ⬇️ Export CSV
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #EFEFEF", backgroundColor: "white", padding: "0 28px" }}>
        {[
          { key: "arsip", label: "📋 Semua Arsip" },
          { key: "masa_berlaku", label: `⏰ Masa Berlaku${expiringCount > 0 ? ` (${expiringCount} segera)` : ""}` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as "arsip" | "masa_berlaku")}
            style={{ padding: "11px 20px", border: "none", borderBottom: `2px solid ${activeTab === tab.key ? "#0344D8" : "transparent"}`, backgroundColor: "transparent", color: activeTab === tab.key ? "#0344D8" : "#6B7280", fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 28px" }}>

        {/* ===================== TAB ARSIP ===================== */}
        {activeTab === "arsip" && (
          <>
            {/* Summary stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total Dokumen", value: documents.length, color: "#0344D8" },
                { label: "Segera Expired", value: documents.filter(d => d.status_retensi === "Expiring Soon").length, color: "#D97706" },
                { label: "Sudah Expired", value: documents.filter(d => d.status_retensi === "Expired").length, color: "#DC2626" },
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

            {/* Table arsip */}
            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 110px 110px 130px 90px 80px 110px", gap: 10, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA" }}>
                {["No", "Dokumen", "Klasifikasi", "Kategori", "Diupload Oleh", "Tgl Upload", "Ukuran", "Retensi s/d"].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                ))}
              </div>
              {loading ? (
                <SkeletonPage rows={6} cols="40px 1fr 110px 110px 130px 90px 80px 110px" />
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
                      style={{ display: "grid", gridTemplateColumns: "40px 1fr 110px 110px 130px 90px 80px 110px", gap: 10, padding: "12px 16px", borderBottom: i < documents.length - 1 ? "1px solid #F5F5F5" : "none", alignItems: "flex-start" }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "#FAFBFF"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}>
                      <span style={{ fontSize: 12, color: "#9CA3AF" }}>{doc.no_urut}</span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1F2E", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.judul_dokumen}</p>
                        <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.nama_file}</p>
                      </div>
                      <div><span style={{ fontSize: 10, fontWeight: 600, backgroundColor: clsCfg.bg, color: clsCfg.color, padding: "2px 7px", borderRadius: 4 }}>{doc.klasifikasi}</span></div>
                      <span style={{ fontSize: 11, color: "#6B7280" }}>{doc.kategori}</span>
                      <div style={{ minWidth: 0 }}><p style={{ fontSize: 11, color: "#374151", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.diupload_oleh || "—"}</p></div>
                      <span style={{ fontSize: 11, color: "#6B7280" }}>{formatDate(doc.tanggal_upload)}</span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{doc.ukuran_kb} KB</span>
                      <div>
                        <p style={{ fontSize: 11, color: "#374151", margin: "0 0 3px" }}>{formatDate(doc.retensi_sampai)}</p>
                        <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: statusCfg.bg, color: statusCfg.color, padding: "1px 6px", borderRadius: 4 }}>{statusCfg.label}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ===================== TAB MASA BERLAKU ===================== */}
        {activeTab === "masa_berlaku" && (
          <>
            {/* Alert stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Total Berisi Masa Berlaku", value: validityDocs.length, color: "#0344D8" },
                { label: "Akan Berakhir (30 hari)", value: expiringCount, color: "#D97706" },
                { label: "Sudah Berakhir", value: expiredCount, color: "#DC2626" },
              ].map(s => (
                <div key={s.label} style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 12, padding: "14px 16px" }}>
                  <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 4px" }}>{s.label}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Search + Filter bar */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              {/* Search */}
              <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
                <input type="text" value={validitySearch} onChange={e => setValiditySearch(e.target.value)}
                  placeholder="Cari dokumen atau pihak..."
                  style={{ width: "100%", paddingLeft: 36, paddingRight: 14, paddingTop: 8, paddingBottom: 8, border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>

              {/* Filter pills */}
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { value: "all", label: "Semua" },
                  { value: "30", label: "30 hari" },
                  { value: "90", label: "90 hari" },
                  { value: "custom", label: "Custom" },
                ].map(f => (
                  <button key={f.value} onClick={() => setValidityFilter(f.value as "all" | "30" | "90" | "custom")}
                    style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer", fontFamily: "inherit", backgroundColor: validityFilter === f.value ? "#0344D8" : "white", color: validityFilter === f.value ? "white" : "#6B7280", borderColor: validityFilter === f.value ? "#0344D8" : "#E5E7EB" }}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Custom date range */}
              {validityFilter === "custom" && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>s/d</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                </div>
              )}

              {/* Toggle expired */}
              {isAdmin && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#6B7280", flexShrink: 0 }}>
                  <input type="checkbox" checked={showExpired} onChange={e => setShowExpired(e.target.checked)} />
                  Tampilkan yang sudah berakhir
                </label>
              )}
            </div>

            {/* Validity table */}
            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 110px 120px 80px 100px", gap: 10, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA" }}>
                {["Dokumen", "Pihak", "Kategori", "Masa Berlaku", "Sisa", "Status"].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                ))}
              </div>

              {validityLoading ? (
                <SkeletonPage rows={5} cols="1fr 110px 110px 100px 120px 80px" />
              ) : filteredValidity.length === 0 ? (
                <div style={{ padding: "60px 0", textAlign: "center" }}>
                  <p style={{ fontSize: 32, margin: "0 0 8px" }}>⏰</p>
                  <p style={{ color: "#6B7280", fontWeight: 600, margin: 0 }}>Tidak ada dokumen yang sesuai filter</p>
                </div>
              ) : (
                filteredValidity.map((doc, i) => {
                  const days = daysRemaining(doc.valid_until);
                  const isExpired = days < 0;
                  const isExpiringSoon = days >= 0 && days <= 30;
                  const statusColor = isExpired ? "#DC2626" : isExpiringSoon ? "#D97706" : "#16A34A";
                  const statusBg = isExpired ? "#FEF2F2" : isExpiringSoon ? "#FFFBEB" : "#F0FDF4";
                  const statusLabel = isExpired ? "🔴 Berakhir" : isExpiringSoon ? "⚠️ Segera" : "✅ Aktif";

                  return (
                    <div key={doc.id}
                      style={{ display: "grid", gridTemplateColumns: "1fr 160px 110px 120px 80px 100px", gap: 10, padding: "12px 16px", borderBottom: i < filteredValidity.length - 1 ? "1px solid #F5F5F5" : "none", alignItems: "center", backgroundColor: isExpired ? "#FFF8F8" : "white" }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = isExpired ? "#FEF2F2" : "#FAFBFF"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = isExpired ? "#FFF8F8" : "white"}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1F2E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</p>
                        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0" }}>{doc.uploader_name}</p>
                      </div>
                      <p style={{ fontSize: 12, color: "#374151", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.parties || "—"}</p>
                      <span style={{ fontSize: 11, color: "#6B7280" }}>{CATEGORY_LABELS[doc.category as DocumentCategory] || doc.category}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>{formatDate(doc.valid_until)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>
                        {isExpired ? `${Math.abs(days)} hari lalu` : `${days} hari`}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: statusBg, color: statusColor, padding: "3px 8px", borderRadius: 6 }}>{statusLabel}</span>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
