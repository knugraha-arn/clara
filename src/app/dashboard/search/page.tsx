"use client";

import { useState, useCallback, useEffect } from "react";
import DocumentSidePanel from "@/components/documents/DocumentSidePanel";
import { useToast } from "@/components/ui/Toast";
import { useRole } from "@/components/layout/DashboardShell";
import { CATEGORY_LABELS, CLS_CFG, CAT_COLORS, formatDateShort } from "@/lib/utils";
import type { SearchResult, Document, DocumentCategory } from "@/types";

const formatDate = formatDateShort;

interface SearchResultWithUploader extends SearchResult { uploader_name?: string; }
interface Uploader { id: string; name: string; }

function allowedClassificationOptions(role: string) {
  if (["admin", "super_admin"].includes(role)) return ["public", "internal", "confidential", "restricted"];
  if (["contributor", "auditor"].includes(role)) return ["public", "internal", "confidential"];
  return ["public", "internal"];
}

const CLS_LABELS: Record<string, string> = {
  public: "Public", internal: "Internal", confidential: "Confidential", restricted: "Restricted",
};

export default function SearchPage() {
  const role = useRole();
  const { error: toastError } = useToast();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultWithUploader[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedUploaderName, setSelectedUploaderName] = useState<string | undefined>();
  const [showTooltip, setShowTooltip] = useState(false);

  // Filter state
  const [filterCategory, setFilterCategory] = useState("");
  const [filterClassification, setFilterClassification] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterUploaderId, setFilterUploaderId] = useState("");
  const [uploaders, setUploaders] = useState<Uploader[]>([]);
  const activeFilterCount = [filterCategory, filterClassification, filterDateFrom, filterDateTo, filterUploaderId].filter(Boolean).length;

  const classificationOptions = allowedClassificationOptions(role);
  const categoryOptions = Object.entries(CATEGORY_LABELS).sort((a, b) => a[1].localeCompare(b[1], "id"));

  useEffect(() => {
    fetch("/api/uploaders").then(r => r.json()).then(d => setUploaders(d.uploaders || [])).catch(() => {});
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q });
      if (filterCategory) params.set("category", filterCategory);
      if (filterClassification) params.set("classification", filterClassification);
      if (filterDateFrom) params.set("date_from", filterDateFrom);
      if (filterDateTo) params.set("date_to", filterDateTo);
      if (filterUploaderId) params.set("uploader_id", filterUploaderId);
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      toastError("Gagal melakukan pencarian.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterClassification, filterDateFrom, filterDateTo, filterUploaderId, toastError]);

  const handleReset = () => {
    setFilterCategory(""); setFilterClassification("");
    setFilterDateFrom(""); setFilterDateTo(""); setFilterUploaderId("");
  };

  const selectStyle = {
    border: "1px solid #E5E7EB", borderRadius: 8, padding: "7px 10px",
    fontSize: 12, fontFamily: "inherit", outline: "none", backgroundColor: "white",
    cursor: "pointer", color: "#374151",
  };

  return (
    <>
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Pencarian Dokumen</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>Cari dokumen berdasarkan keyword atau konsep</p>
        </div>

        <div style={{ padding: "20px 28px" }}>

          {/* Filter panel — selalu tampil di atas */}
          <div style={{ backgroundColor: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Filter</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {activeFilterCount > 0 && (
                  <button onClick={handleReset}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #FECACA", backgroundColor: "#FEF2F2", color: "#DC2626", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Reset filter
                  </button>
                )}
                {activeFilterCount > 0 && (
                  <span style={{ fontSize: 11, backgroundColor: "#0344D8", color: "white", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{activeFilterCount} aktif</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
              {/* Kategori */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Kategori</label>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={selectStyle}>
                  <option value="">Semua kategori</option>
                  {categoryOptions.map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </div>
              {/* Klasifikasi */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Klasifikasi</label>
                <select value={filterClassification} onChange={e => setFilterClassification(e.target.value)} style={selectStyle}>
                  <option value="">Semua klasifikasi</option>
                  {classificationOptions.map(cls => (
                    <option key={cls} value={cls}>{CLS_LABELS[cls]}</option>
                  ))}
                </select>
              </div>
              {/* Tanggal dari */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dari tanggal</label>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={selectStyle} />
              </div>
              {/* Tanggal sampai */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sampai tanggal</label>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={selectStyle} />
              </div>
              {/* Uploader */}
              {uploaders.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Diupload oleh</label>
                  <select value={filterUploaderId} onChange={e => setFilterUploaderId(e.target.value)} style={selectStyle}>
                    <option value="">Semua pengunggah</option>
                    {uploaders.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Search input + AI tooltip */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</div>
              <input type="text" value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch(query)}
                placeholder="Cari dokumen... misal: 'kontrak kerja sama IT' atau 'surat permohonan'"
                style={{ width: "100%", padding: "12px 130px 12px 44px", borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
              <button onClick={() => handleSearch(query)} disabled={loading || !query.trim()}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", backgroundColor: "#0344D8", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: loading || !query.trim() ? 0.5 : 1 }}>
                {loading ? "..." : "Cari"}
              </button>
            </div>

            {/* AI tooltip */}
            <div style={{ position: "relative" }}>
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderRadius: 12, border: "1px solid #E5E7EB", backgroundColor: "white", color: "#6B7280", fontSize: 13, fontWeight: 500, cursor: "default", fontFamily: "inherit", flexShrink: 0, height: "100%" }}>
                🤖 AI
              </button>
              {showTooltip && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", backgroundColor: "#1A1F2E", color: "white", borderRadius: 12, padding: "14px 16px", width: 300, zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "white" }}>🤖 AI-Powered Search</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: "0 0 10px", lineHeight: 1.5 }}>Pencarian ini menggunakan 2 metode secara bersamaan:</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 10px" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#4ADE80", margin: "0 0 2px" }}>🔍 Exact Match</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.4 }}>Cocokkan kata kunci di judul, ringkasan, dan isi dokumen</p>
                    </div>
                    <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 10px" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#818CF8", margin: "0 0 2px" }}>✨ Semantic Search</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.4 }}>Temukan dokumen berdasarkan makna. Cari &quot;perjanjian rahasia&quot; bisa return dokumen NDA meski kata-katanya berbeda</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", margin: "10px 0 0" }}>Hasil disesuaikan dengan hak akses kamu</p>
                </div>
              )}
            </div>
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
                {loading ? "Mencari..." : `${results.length} dokumen ditemukan${activeFilterCount > 0 ? " (dengan filter)" : ""}`}
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
                          {result.snippet && <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic" }}>&quot;{result.snippet.slice(0, 100)}...&quot;</p>}
                        </div>
                        <div><span style={{ fontSize: 10, fontWeight: 600, backgroundColor: clsStyle.bg, color: clsStyle.color, padding: "2px 6px", borderRadius: 4 }}>{clsStyle.label}</span></div>
                        <div><span style={{ fontSize: 10, fontWeight: 600, backgroundColor: catStyle.bg, color: catStyle.color, padding: "2px 6px", borderRadius: 4 }}>{CATEGORY_LABELS[doc.category as DocumentCategory] || doc.category}</span></div>
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
                  <p style={{ fontSize: 13, color: "#9CA3AF" }}>
                    {activeFilterCount > 0 ? "Coba ubah atau reset filter" : "Coba kata kunci yang berbeda"}
                  </p>
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
