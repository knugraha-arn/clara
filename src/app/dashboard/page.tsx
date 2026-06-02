"use client";

import { useState, useEffect, useCallback } from "react";
import DocumentUpload from "@/components/documents/DocumentUpload";
import { CATEGORY_LABELS } from "@/lib/utils";
import type { Document } from "@/types";

const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  surat_masuk:  { bg: "#EEF2FF", color: "#0344D8" },
  surat_keluar: { bg: "#F0FDF4", color: "#16A34A" },
  kontrak:      { bg: "#FFFBEB", color: "#D97706" },
  memo:         { bg: "#F9FAFB", color: "#6B7280" },
  laporan:      { bg: "#EFF6FF", color: "#2563EB" },
  kebijakan:    { bg: "#FEF2F2", color: "#DC2626" },
  undangan:     { bg: "#FDF4FF", color: "#9333EA" },
  pengumuman:   { bg: "#FFF7ED", color: "#EA580C" },
  lainnya:      { bg: "#F9FAFB", color: "#9CA3AF" },
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}
function formatSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORIES = [
  { value: "all", label: "Semua" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const url = activeCategory === "all" ? "/api/documents" : `/api/documents?category=${activeCategory}`;
    const res = await fetch(url);
    const data = await res.json();
    setDocuments(data.documents || []);
    setLoading(false);
  }, [activeCategory]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus dokumen ini?")) return;
    await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleDownload = async (id: string) => {
    const res = await fetch(`/api/documents/${id}/download`);
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  };

  const today = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Dokumen</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#9CA3AF" }}>{today}</span>
          <button
            onClick={() => setShowUpload(!showUpload)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              backgroundColor: showUpload ? "#F3F4F6" : "#0344D8",
              color: showUpload ? "#374151" : "white",
              border: "none", borderRadius: 10, padding: "8px 16px",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {showUpload ? "✕ Tutup" : "+ Upload"}
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 28px" }}>
        {/* Upload panel */}
        {showUpload && (
          <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <p style={{ fontWeight: 600, color: "#1A1F2E", margin: "0 0 14px", fontSize: 14 }}>Upload Dokumen Baru</p>
            <DocumentUpload onSuccess={() => { setShowUpload(false); fetchDocuments(); }} />
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total Dokumen", value: documents.length, color: "#0344D8" },
            { label: "Surat Masuk", value: documents.filter(d => d.category === "surat_masuk").length, color: "#16A34A" },
            { label: "Surat Keluar", value: documents.filter(d => d.category === "surat_keluar").length, color: "#D97706" },
            { label: "Kontrak", value: documents.filter(d => d.category === "kontrak").length, color: "#9333EA" },
          ].map((stat) => (
            <div key={stat.label} style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 4px" }}>{stat.label}</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: stat.color, margin: 0 }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              style={{
                flexShrink: 0, padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                border: "1px solid", cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s",
                backgroundColor: activeCategory === cat.value ? "#0344D8" : "white",
                color: activeCategory === cat.value ? "white" : "#6B7280",
                borderColor: activeCategory === cat.value ? "#0344D8" : "#E5E7EB",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Document list */}
        <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
          {/* List header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 100px 80px 90px", gap: 12, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA" }}>
            {["Dokumen", "Kategori", "Tanggal", "Ukuran", "Aksi"].map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Memuat...</div>
          ) : documents.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <p style={{ fontSize: 32, margin: "0 0 8px" }}>📂</p>
              <p style={{ fontWeight: 600, color: "#6B7280", margin: 0 }}>Belum ada dokumen</p>
              <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>Upload PDF pertama Anda</p>
            </div>
          ) : (
            documents.map((doc, i) => {
              const catStyle = CAT_COLORS[doc.category] || CAT_COLORS.lainnya;
              const isHovered = hoveredId === doc.id;
              return (
                <div
                  key={doc.id}
                  onMouseEnter={() => setHoveredId(doc.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 140px 100px 80px 90px",
                    gap: 12,
                    padding: "11px 16px",
                    borderBottom: i < documents.length - 1 ? "1px solid #F5F5F5" : "none",
                    backgroundColor: isHovered ? "#FAFBFF" : "white",
                    transition: "background 0.1s",
                    alignItems: "center",
                  }}
                >
                  {/* Title + summary */}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1F2E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.title}
                    </p>
                    {doc.summary && (
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.summary}
                      </p>
                    )}
                    {doc.tags?.length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                        {doc.tags.slice(0, 3).map((tag) => (
                          <span key={tag} style={{ fontSize: 10, backgroundColor: "#F3F4F6", color: "#6B7280", padding: "1px 6px", borderRadius: 4 }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: catStyle.bg, color: catStyle.color, padding: "3px 8px", borderRadius: 5 }}>
                      {CATEGORY_LABELS[doc.category]}
                    </span>
                  </div>

                  {/* Date */}
                  <span style={{ fontSize: 12, color: "#6B7280" }}>{formatDate(doc.created_at)}</span>

                  {/* Size */}
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>{formatSize(doc.file_size)}</span>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => handleDownload(doc.id)}
                      title="Download"
                      style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #E5E7EB", backgroundColor: "white", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      title="Hapus"
                      style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #FEE2E2", backgroundColor: "white", cursor: "pointer", fontSize: 13, color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      ×
                    </button>
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
