"use client";

import { useState, useEffect, useCallback } from "react";
import DocumentUpload from "@/components/documents/DocumentUpload";
import DocumentCard from "@/components/documents/DocumentCard";
import { CATEGORY_LABELS } from "@/lib/utils";
import type { Document } from "@/types";

const CATEGORIES = [
  { value: "all", label: "Semua" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

const S = {
  page: { fontFamily: "'DM Sans', system-ui, sans-serif" } as React.CSSProperties,
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 } as React.CSSProperties,
  title: { fontWeight: 700, fontSize: 20, color: "#1A1F2E", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "#9CA3AF", marginTop: 2 } as React.CSSProperties,
  uploadBtn: { display: "flex", alignItems: "center", gap: 6, backgroundColor: "#0344D8", color: "white", border: "none", borderRadius: 12, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: "'DM Sans', system-ui, sans-serif" } as React.CSSProperties,
  closeBtn: { display: "flex", alignItems: "center", gap: 6, backgroundColor: "#F3F4F6", color: "#374151", border: "none", borderRadius: 12, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: "'DM Sans', system-ui, sans-serif" } as React.CSSProperties,
  card: { backgroundColor: "white", border: "1px solid #F0F0F0", borderRadius: 16, padding: 24, marginBottom: 24 } as React.CSSProperties,
  filterWrap: { display: "flex", gap: 6, overflowX: "auto" as const, marginBottom: 20, paddingBottom: 2 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 } as React.CSSProperties,
  empty: { textAlign: "center" as const, padding: "80px 0", color: "#9CA3AF" },
  skeleton: { backgroundColor: "white", border: "1px solid #F0F0F0", borderRadius: 16, padding: 20, height: 130 } as React.CSSProperties,
};

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");

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

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Dokumen</h1>
          <p style={S.subtitle}>{documents.length} dokumen tersimpan</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          style={showUpload ? S.closeBtn : S.uploadBtn}
        >
          {showUpload ? "✕ Tutup" : "+ Upload"}
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div style={S.card}>
          <p style={{ fontWeight: 600, color: "#1A1F2E", marginBottom: 16, marginTop: 0, fontSize: 15 }}>Upload Dokumen Baru</p>
          <DocumentUpload onSuccess={() => { setShowUpload(false); fetchDocuments(); }} />
        </div>
      )}

      {/* Category filters */}
      <div style={S.filterWrap}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            style={{
              flexShrink: 0,
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid",
              cursor: "pointer",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              backgroundColor: activeCategory === cat.value ? "#0344D8" : "white",
              color: activeCategory === cat.value ? "white" : "#6B7280",
              borderColor: activeCategory === cat.value ? "#0344D8" : "#E5E7EB",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={S.grid}>
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} style={{ ...S.skeleton, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <p style={{ fontWeight: 600, color: "#6B7280", margin: 0 }}>Belum ada dokumen</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Upload PDF pertama Anda untuk memulai</p>
          <button
            onClick={() => setShowUpload(true)}
            style={{ marginTop: 16, color: "#0344D8", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            Upload sekarang →
          </button>
        </div>
      ) : (
        <div style={S.grid}>
          {documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
