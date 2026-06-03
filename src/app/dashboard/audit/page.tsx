"use client";

import { useState, useEffect } from "react";
import { useRole } from "@/components/layout/DashboardShell";
import type { DocumentLog, AuditEventType } from "@/types";

const EVENT_CONFIG: Record<AuditEventType, { label: string; color: string; bg: string; icon: string }> = {
  uploaded:               { label: "Upload",           color: "#0344D8", bg: "#EEF2FF", icon: "⬆️" },
  viewed:                 { label: "Dilihat",          color: "#6B7280", bg: "#F3F4F6", icon: "👁️" },
  downloaded:             { label: "Download",         color: "#16A34A", bg: "#F0FDF4", icon: "⬇️" },
  deleted:                { label: "Dihapus",          color: "#DC2626", bg: "#FEF2F2", icon: "🗑️" },
  searched:               { label: "Dicari",           color: "#9333EA", bg: "#FDF4FF", icon: "🔍" },
  classification_changed: { label: "Klasifikasi Diubah", color: "#D97706", bg: "#FFFBEB", icon: "🏷️" },
  role_changed:           { label: "Role Diubah",      color: "#0891B2", bg: "#ECFEFF", icon: "👤" },
};

function formatDateTime(d: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export default function AuditPage() {
  const role = useRole();
  const canView = ["super_admin", "admin", "auditor"].includes(role);

  const [logs, setLogs] = useState<DocumentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState("all");

  useEffect(() => {
    if (!canView) return;
    const fetchLogs = async () => {
      setLoading(true);
      const url = eventFilter === "all" ? "/api/audit" : `/api/audit?event_type=${eventFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setLogs(data.logs || []);
      setLoading(false);
    };
    fetchLogs();
  }, [canView, eventFilter]);

  if (!canView) {
    return (
      <div style={{ padding: "40px 28px", textAlign: "center", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔒</p>
        <p style={{ fontWeight: 600, color: "#6B7280" }}>Akses ditolak</p>
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>Hanya Super Admin, Admin, dan Auditor yang dapat melihat audit trail</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Audit Trail</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>Log semua aktivitas dokumen — immutable</p>
        </div>
      </div>

      <div style={{ padding: "20px 28px" }}>
        {/* Event filter */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setEventFilter("all")}
            style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer", fontFamily: "inherit", backgroundColor: eventFilter === "all" ? "#1A1F2E" : "white", color: eventFilter === "all" ? "white" : "#6B7280", borderColor: eventFilter === "all" ? "#1A1F2E" : "#E5E7EB" }}>
            Semua
          </button>
          {(Object.keys(EVENT_CONFIG) as AuditEventType[]).map((evt) => (
            <button key={evt} onClick={() => setEventFilter(evt)}
              style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer", fontFamily: "inherit", backgroundColor: eventFilter === evt ? EVENT_CONFIG[evt].color : "white", color: eventFilter === evt ? "white" : "#6B7280", borderColor: eventFilter === evt ? EVENT_CONFIG[evt].color : "#E5E7EB" }}>
              {EVENT_CONFIG[evt].icon} {EVENT_CONFIG[evt].label}
            </button>
          ))}
        </div>

        {/* Log table */}
        <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "140px 120px 1fr 140px", gap: 12, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA" }}>
            {["Waktu", "Event", "Dokumen & User", "Detail"].map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Memuat log...</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <p style={{ fontSize: 24, margin: "0 0 8px" }}>📋</p>
              <p style={{ color: "#9CA3AF", fontSize: 13 }}>Belum ada log aktivitas</p>
            </div>
          ) : (
            logs.map((log, i) => {
              const evtCfg = EVENT_CONFIG[log.event_type] || EVENT_CONFIG.viewed;
              return (
                <div key={log.id}
                  style={{ display: "grid", gridTemplateColumns: "140px 120px 1fr 140px", gap: 12, padding: "11px 16px", borderBottom: i < logs.length - 1 ? "1px solid #F5F5F5" : "none", alignItems: "flex-start" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#FAFBFF"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                >
                  <span style={{ fontSize: 11, color: "#6B7280" }}>{formatDateTime(log.created_at)}</span>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: evtCfg.bg, color: evtCfg.color, padding: "3px 8px", borderRadius: 5 }}>
                      {evtCfg.icon} {evtCfg.label}
                    </span>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1F2E", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.document_title || "—"}
                    </p>
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>
                      {log.user_name || log.user_email}
                    </p>
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div>
                        {log.event_type === "classification_changed" && (
                          <p style={{ margin: 0 }}>
                            {String(log.metadata.from)} → {String(log.metadata.to)}
                          </p>
                        )}
                        {log.event_type === "uploaded" && (
                          <p style={{ margin: 0 }}>{String(log.metadata.classification)}</p>
                        )}
                      </div>
                    )}
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
