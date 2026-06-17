"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "@/components/layout/DashboardShell";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { SkeletonPage } from "@/components/ui/Skeleton";
import type { DocumentLog, AuditEventType } from "@/types";

const EVENT_CONFIG: Record<AuditEventType, { label: string; color: string; bg: string; icon: string }> = {
  uploaded:               { label: "Upload",            color: "#0344D8", bg: "#EEF2FF", icon: "⬆️" },
  viewed:                 { label: "Dilihat",           color: "#6B7280", bg: "#F3F4F6", icon: "👁️" },
  downloaded:             { label: "Download",          color: "#16A34A", bg: "#F0FDF4", icon: "⬇️" },
  deleted:                { label: "Dihapus",           color: "#DC2626", bg: "#FEF2F2", icon: "🗑️" },
  searched:               { label: "Dicari",            color: "#9333EA", bg: "#FDF4FF", icon: "🔍" },
  classification_changed: { label: "Klasifikasi Diubah",color: "#D97706", bg: "#FFFBEB", icon: "🏷️" },
  role_changed:           { label: "Role Diubah",       color: "#0891B2", bg: "#ECFEFF", icon: "👤" },
};

async function generateAuditPDF(logs: DocumentLog[], eventFilter: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());

  doc.setFillColor(3, 68, 216);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("CLARA — Audit Trail Log", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Digenerate: " + now + "  |  Filter: " + (eventFilter === "all" ? "Semua Event" : eventFilter) + "  |  Total: " + logs.length + " record", 14, 18);

  autoTable(doc, {
    startY: 28,
    head: [["Waktu", "Event", "Dokumen", "User", "Email", "Detail"]],
    body: logs.map(log => {
      const evtCfg = EVENT_CONFIG[log.event_type] || EVENT_CONFIG.viewed;
      let detail = "";
      if (log.event_type === "classification_changed") {
        detail = `${log.metadata?.from} → ${log.metadata?.to}`;
      } else if (log.event_type === "uploaded") {
        detail = String(log.metadata?.classification || "");
      } else if (log.event_type === "role_changed") {
        detail = String(log.metadata?.action || `${log.metadata?.from_role} → ${log.metadata?.to_role}`);
      }
      return [
        formatDateTime(log.created_at),
        evtCfg.icon + " " + evtCfg.label,
        log.document_title || "—",
        log.user_name || "—",
        log.user_email,
        detail,
      ];
    }),
    theme: "grid",
    headStyles: { fillColor: [3, 68, 216], textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 28 },
      2: { cellWidth: 60 },
      3: { cellWidth: 35 },
      4: { cellWidth: 45 },
    },
    margin: { left: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      "Halaman " + i + " dari " + pageCount + "  |  CLARA Audit Trail  |  CONFIDENTIAL  |  Arranetwork © " + new Date().getFullYear(),
      14, doc.internal.pageSize.getHeight() - 6
    );
  }

  doc.save("CLARA_AuditTrail_" + new Date().toISOString().split("T")[0] + ".pdf");
}

export default function AuditPage() {
  const role = useRole();
  const canView = ["super_admin", "admin", "auditor"].includes(role);

  const { error: toastError } = useToast();
  const [logs, setLogs] = useState<DocumentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const url = eventFilter === "all" ? "/api/audit" : `/api/audit?event_type=${eventFilter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      toastError("Gagal memuat audit log.");
    } finally {
      setLoading(false);
    }
  }, [canView, eventFilter, toastError]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleDownloadPDF = async () => {
    setGeneratingPDF(true);
    try { await generateAuditPDF(filteredLogs, eventFilter); }
    finally { setGeneratingPDF(false); }
  };

  // Filter by search
  const filteredLogs = logs.filter(log => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.document_title?.toLowerCase().includes(q) ||
      log.user_name?.toLowerCase().includes(q) ||
      log.user_email?.toLowerCase().includes(q) ||
      log.event_type?.toLowerCase().includes(q)
    );
  });

  if (!canView) {
    return (
      <div style={{ padding: "40px 28px", textAlign: "center", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔒</p>
        <p style={{ fontWeight: 600, color: "#6B7280" }}>Akses ditolak</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Audit Trail</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>Log immutable — {filteredLogs.length} record</p>
        </div>
        <button onClick={handleDownloadPDF} disabled={generatingPDF || filteredLogs.length === 0}
          style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#DC2626", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: generatingPDF || filteredLogs.length === 0 ? 0.5 : 1 }}>
          {generatingPDF ? "⏳ Generating..." : "📄 Download PDF"}
        </button>
      </div>

      <div style={{ padding: "20px 28px" }}>
        {/* Search + Filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari dokumen, user, email..."
              style={{ width: "100%", paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9, border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Event filter */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button onClick={() => setEventFilter("all")}
              style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer", fontFamily: "inherit", backgroundColor: eventFilter === "all" ? "#1A1F2E" : "white", color: eventFilter === "all" ? "white" : "#6B7280", borderColor: eventFilter === "all" ? "#1A1F2E" : "#E5E7EB" }}>
              Semua
            </button>
            {(Object.keys(EVENT_CONFIG) as AuditEventType[]).map(evt => (
              <button key={evt} onClick={() => setEventFilter(evt)}
                style={{ padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 500, border: "1px solid", cursor: "pointer", fontFamily: "inherit", backgroundColor: eventFilter === evt ? EVENT_CONFIG[evt].color : "white", color: eventFilter === evt ? "white" : "#6B7280", borderColor: eventFilter === evt ? EVENT_CONFIG[evt].color : "#E5E7EB" }}>
                {EVENT_CONFIG[evt].icon} {EVENT_CONFIG[evt].label}
              </button>
            ))}
          </div>
        </div>

        {/* Log table */}
        <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "140px 130px 1fr 140px 140px", gap: 12, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA" }}>
            {["Waktu", "Event", "Dokumen & User", "Email", "Detail"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <SkeletonPage rows={8} cols="140px 100px 1fr 140px 160px 160px" />
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <p style={{ fontSize: 24, margin: "0 0 8px" }}>📋</p>
              <p style={{ color: "#9CA3AF", fontSize: 13 }}>{search ? "Tidak ada log yang cocok" : "Belum ada log aktivitas"}</p>
            </div>
          ) : (
            filteredLogs.map((log, i) => {
              const evtCfg = EVENT_CONFIG[log.event_type] || EVENT_CONFIG.viewed;
              let detail = "";
              if (log.event_type === "classification_changed") {
                detail = `${log.metadata?.from} → ${log.metadata?.to}`;
                if (log.metadata?.reason) detail += ` (${log.metadata.reason})`;
              } else if (log.event_type === "uploaded") {
                detail = String(log.metadata?.classification || "");
              } else if (log.event_type === "role_changed") {
                detail = String(log.metadata?.action || `${log.metadata?.from_role} → ${log.metadata?.to_role}`);
              } else if (log.event_type === "downloaded") {
                detail = String(log.metadata?.classification || "");
              }

              return (
                <div key={log.id}
                  style={{ display: "grid", gridTemplateColumns: "140px 130px 1fr 140px 140px", gap: 12, padding: "11px 16px", borderBottom: i < filteredLogs.length - 1 ? "1px solid #F5F5F5" : "none", alignItems: "flex-start" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#FAFBFF"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                >
                  <span style={{ fontSize: 11, color: "#6B7280" }}>{formatDateTime(log.created_at)}</span>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: evtCfg.bg, color: evtCfg.color, padding: "3px 8px", borderRadius: 5 }}>
                      {evtCfg.icon} {evtCfg.label}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1F2E", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.document_title || "—"}
                    </p>
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{log.user_name || "—"}</p>
                  </div>
                  <span style={{ fontSize: 11, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.user_email}</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{detail}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
