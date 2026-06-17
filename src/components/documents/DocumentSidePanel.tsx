"use client";

import { useState, useEffect, useCallback } from "react";
import type { Document } from "@/types";
import { CATEGORY_LABELS, CLS_CFG, formatDateTime, formatSize } from "@/lib/utils";
import { useRole } from "@/components/layout/DashboardShell";

const formatDate = formatDateTime;

interface DocumentSidePanelProps {
  document: Document | null;
  uploaderName?: string;
  onClose: () => void;
}

export default function DocumentSidePanel({ document: doc, uploaderName, onClose }: DocumentSidePanelProps) {
  const role = useRole();
  const canDownload = role !== "viewer";
  const [parties, setParties] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!doc) { setParties([]); return; }
    fetch(`/api/documents/${doc.id}/parties`)
      .then(r => r.json())
      .then(d => setParties(d.parties || []));
  }, [doc?.id]);

  const handlePreview = useCallback(async () => {
    if (!doc) return;
    const res = await fetch(`/api/documents/${doc.id}/preview`);
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }, [doc]);

  const handleDownload = useCallback(async () => {
    if (!doc) return;
    // Force download — browser prompt Save As dengan nama file asli
    const a = window.document.createElement("a");
    a.href = `/api/documents/${doc.id}/download`;
    a.download = doc.file_name;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  }, [doc]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isOpen = !!doc;
  const clsCfg = doc ? (CLS_CFG[doc.classification] || CLS_CFG.internal) : null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.2)",
          zIndex: 100, opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 400, backgroundColor: "white",
        zIndex: 101, display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s ease",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EFEFEF", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#1A1F2E", margin: "0 0 6px", lineHeight: 1.3 }}>
              {doc?.title || ""}
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {doc && clsCfg && (
                <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: clsCfg.bg, color: clsCfg.color, padding: "2px 8px", borderRadius: 5 }}>
                  {clsCfg.label}
                </span>
              )}
              {doc && (
                <span style={{ fontSize: 11, fontWeight: 500, backgroundColor: "#F3F4F6", color: "#6B7280", padding: "2px 8px", borderRadius: 5 }}>
                  {CATEGORY_LABELS[doc.category] || doc.category}
                </span>
              )}
              {doc?.is_scanned && (
                <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: "#FFFBEB", color: "#D97706", padding: "2px 8px", borderRadius: 5, display: "flex", alignItems: "center", gap: 3 }}>
                  📷 Scan
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #E5E7EB", backgroundColor: "white", cursor: "pointer", fontSize: 16, color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            ×
          </button>
        </div>

        {/* Content */}
        {doc && (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            {/* Scan notice */}
            {doc.is_scanned && (
              <div style={{ marginBottom: 16, backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>📷</span>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", margin: 0 }}>Dokumen Scan</p>
                </div>
                <p style={{ fontSize: 11, color: "#7F1D1D", margin: 0, lineHeight: 1.5 }}>
                  AI tidak dapat membaca isi dokumen ini. Klasifikasi ditetapkan secara manual oleh uploader — pastikan sudah sesuai dengan isi dokumen yang sebenarnya.
                </p>
              </div>
            )}

            {/* Summary */}
            {doc.summary && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Ringkasan</p>
                <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0 }}>{doc.summary}</p>
              </div>
            )}

            {/* Metadata grid */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>Detail Dokumen</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Diupload oleh", value: uploaderName || "—" },
                  { label: "Tanggal upload", value: formatDate(doc.created_at) },
                  { label: "Ukuran file", value: formatSize(doc.file_size) },
                  { label: "Jumlah halaman", value: doc.page_count ? `${doc.page_count} halaman` : "—" },
                  { label: "Nama file", value: doc.file_name },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 12, color: "#9CA3AF", width: 120, flexShrink: 0 }}>{item.label}</span>
                    <span style={{ fontSize: 12, color: "#374151", fontWeight: 500, flex: 1, wordBreak: "break-all" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pihak yang terlibat */}
            {parties.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Pihak yang Terlibat</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {parties.map((party) => (
                    <div key={party.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", backgroundColor: "#EEF2FF", borderRadius: 8 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>🏢</span>
                      <span style={{ fontSize: 12, color: "#0344D8", fontWeight: 500 }}>{party.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Masa Berlaku */}
            {doc.valid_until && (() => {
              const expDate = new Date(doc.valid_until);
              const today = new Date();
              today.setHours(0,0,0,0);
              const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isExpired = diffDays < 0;
              const isExpiringSoon = diffDays >= 0 && diffDays <= 30;
              const color = isExpired ? "#DC2626" : isExpiringSoon ? "#D97706" : "#16A34A";
              const bg = isExpired ? "#FEF2F2" : isExpiringSoon ? "#FFFBEB" : "#F0FDF4";
              const border = isExpired ? "#FECACA" : isExpiringSoon ? "#FDE68A" : "#BBF7D0";
              const label = isExpired ? "⛔ Sudah berakhir" : isExpiringSoon ? `⚠️ Berakhir dalam ${diffDays} hari` : `✅ Berlaku hingga`;
              return (
                <div style={{ marginBottom: 20, backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color, margin: "0 0 4px" }}>Masa Berlaku Dokumen</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color, margin: "0 0 2px" }}>
                    {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(expDate)}
                  </p>
                  <p style={{ fontSize: 11, color, margin: 0 }}>{label}</p>
                </div>
              );
            })()}

            {/* Classification override info */}
            {doc.classification_overridden && (
              <div style={{ marginBottom: 20, backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#D97706", margin: "0 0 4px" }}>⚠️ Klasifikasi diubah manual</p>
                <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>
                  AI suggest: <strong>{doc.classification_ai_suggestion}</strong>
                  {doc.classification_override_reason && ` · "${doc.classification_override_reason}"`}
                </p>
              </div>
            )}

            {/* Tags */}
            {doc.tags?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Tags</p>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {doc.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: 12, backgroundColor: "#F3F4F6", color: "#6B7280", padding: "4px 10px", borderRadius: 6 }}>{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        {doc && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid #EFEFEF", display: "flex", gap: 8 }}>
            <button onClick={handlePreview}
              style={{ flex: canDownload ? 1 : undefined, width: canDownload ? undefined : "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
              👁️ Preview
            </button>
            {canDownload && (
              <button onClick={handleDownload}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#0344D8", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer", fontFamily: "inherit" }}>
                ⬇️ Download
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
