"use client";

import { useState, useCallback } from "react";
import DocumentSidePanel from "@/components/documents/DocumentSidePanel";
import { CATEGORY_LABELS } from "@/lib/utils";
import type { SearchResult, Document } from "@/types";

const CLS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  public:       { label: "Public",       color: "#16A34A", bg: "#F0FDF4" },
  internal:     { label: "Internal",     color: "#0344D8", bg: "#EEF2FF" },
  confidential: { label: "Confidential", color: "#D97706", bg: "#FFFBEB" },
  restricted:   { label: "Restricted",   color: "#DC2626", bg: "#FEF2F2" },
};

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

interface SearchResultWithUploader extends SearchResult { uploader_name?: string; }

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultWithUploader[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedUploaderName, setSelectedUploaderName] = useState<string | undefined>();

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  return (
    <>
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Pencarian Dokumen</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>Cari dokumen berdasarkan keyword atau konsep</p>
        </div>

        <div style={{ padding: "20px 28px" }}>
          {/* Search input */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</div>
            <input type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch(query)}
              placeholder="Cari dokumen... misal: 'kontrak kerja sama IT' atau 'surat permohonan'"
              style={{ width: "100%", padding: "13px 130px 13px 44px", borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 14, fontFamily: "inherit", backgroundColor: "white", outline: "none", boxSizing: "border-box" }}
            />
            <button onClick={() => handleSearch(query)} disabled={loading || !query.trim()}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", backgroundColor: "#0344D8", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: loading || !query.trim() ? 0.5 : 1 }}>
              {loading ? "..." : "Cari"}
            </button>
          </div>

          {/* Hints */}
          {!searched && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { icon: "🔍", title: "Exact Match", desc: "Nomor surat, nama file, kata kunci spesifik" },
                { icon: "✨", title: "AI Semantic", desc: "Deskripsi konseptual, sinonim, konteks" },
              ].map(h => (
                <div key={h.title} style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{h.icon}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13, color: "#1A1F2E", margin: 0 }}>{h.title}</p>
                    <p style={{ fontSize: 12, color: "#9CA3AF", margin: "3px 0 0" }}>{h.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          {searched && (
            <div>
              <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 12 }}>
                {loading ? "Mencari..." : `${results.length} dokumen ditemukan`}
              </p>
              {!loading && results.length > 0 && (
                <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 120px 90px", gap: 10, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA" }}>
                    {["Dokumen", "Klasifikasi", "Kategori", "Diupload oleh", "Tgl Upload"].map(h => (
                      <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                    ))}
                  </div>
                  {results.map((result, i) => {
                    const doc = result.document;
                    const clsStyle = CLS_CFG[doc.classification] || CLS_CFG.internal;
                    const catStyle = CAT_COLORS[doc.category] || CAT_COLORS.lainnya;
                    const isSelected = selectedDoc?.id === doc.id;
                    return (
                      <div key={doc.id}
                        onClick={() => { setSelectedDoc(isSelected ? null : doc); setSelectedUploaderName(result.uploader_name); }}
                        style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 120px 90px", gap: 10, padding: "12px 16px", borderBottom: i < results.length - 1 ? "1px solid #F5F5F5" : "none", backgroundColor: isSelected ? "#F0F5FF" : "white", cursor: "pointer", alignItems: "flex-start" }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "#FAFBFF"; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = isSelected ? "#F0F5FF" : "white"; }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1F2E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</p>
                            <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: result.match_type === "semantic" ? "#EEF2FF" : "#F0FDF4", color: result.match_type === "semantic" ? "#0344D8" : "#16A34A", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>{result.match_type}</span>
                          </div>
                          {result.snippet && <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic" }}>"{result.snippet.slice(0, 100)}..."</p>}
                        </div>
                        <div><span style={{ fontSize: 10, fontWeight: 600, backgroundColor: clsStyle.bg, color: clsStyle.color, padding: "2px 6px", borderRadius: 4 }}>{clsStyle.label}</span></div>
                        <div><span style={{ fontSize: 10, fontWeight: 600, backgroundColor: catStyle.bg, color: catStyle.color, padding: "2px 6px", borderRadius: 4 }}>{CATEGORY_LABELS[doc.category] || doc.category}</span></div>
                        <span style={{ fontSize: 11, color: "#6B7280" }}>{result.uploader_name || "—"}</span>
                        <span style={{ fontSize: 11, color: "#6B7280" }}>{formatDate(doc.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {!loading && results.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔍</p>
                  <p style={{ color: "#6B7280", fontWeight: 600 }}>Tidak ada dokumen ditemukan</p>
                  <p style={{ fontSize: 13, color: "#9CA3AF" }}>Coba kata kunci yang berbeda</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <DocumentSidePanel
        document={selectedDoc}
        uploaderName={selectedUploaderName}
        onClose={() => { setSelectedDoc(null); setSelectedUploaderName(undefined); }}
      />
    </>
  );
}
