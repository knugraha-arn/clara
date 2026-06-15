"use client";

import { useState, useEffect, useCallback } from "react";

const skeletonStyle = {
  background: "linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.4s infinite",
  borderRadius: 8,
};

function SkeletonRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 130px 90px 80px", gap: 10, padding: "14px 16px", borderBottom: "1px solid #F5F5F5", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ ...skeletonStyle, height: 14, width: "60%" }} />
        <div style={{ ...skeletonStyle, height: 11, width: "40%" }} />
      </div>
      <div style={{ ...skeletonStyle, height: 20, width: 70, borderRadius: 4 }} />
      <div style={{ ...skeletonStyle, height: 20, width: 80, borderRadius: 4 }} />
      <div style={{ ...skeletonStyle, height: 13, width: 90 }} />
      <div style={{ ...skeletonStyle, height: 13, width: 60 }} />
      <div style={{ ...skeletonStyle, height: 13, width: 50 }} />
    </div>
  );
}

function SkeletonStatCard() {
  return (
    <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "16px 20px" }}>
      <div style={{ ...skeletonStyle, height: 12, width: 80, marginBottom: 10 }} />
      <div style={{ ...skeletonStyle, height: 28, width: 50 }} />
    </div>
  );
}
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import DocumentUpload from "@/components/documents/DocumentUpload";
import DocumentSidePanel from "@/components/documents/DocumentSidePanel";
import { useRole } from "@/components/layout/DashboardShell";
import { CATEGORY_LABELS } from "@/lib/utils";
import type { Document, DocumentCategory } from "@/types";

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

const CLS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  public:       { label: "Public",       color: "#16A34A", bg: "#F0FDF4" },
  internal:     { label: "Internal",     color: "#0344D8", bg: "#EEF2FF" },
  confidential: { label: "Confidential", color: "#D97706", bg: "#FFFBEB" },
  restricted:   { label: "Restricted",   color: "#DC2626", bg: "#FEF2F2" },
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}
function formatSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

type SortKey = "created_at" | "title" | "category" | "file_size" | "classification";
type SortDir = "asc" | "desc";
const PAGE_SIZE_OPTIONS = [10, 20, 30];

interface DocWithUploader extends Document { uploader_name?: string; }

export default function DashboardPage() {
  const role = useRole();
  const canUpload = ["contributor", "admin", "super_admin"].includes(role);
    const [documents, setDocuments] = useState<DocWithUploader[]>([]);
  const [activeCategories, setActiveCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedDoc, setSelectedDoc] = useState<DocWithUploader | null>(null);
  const [preSelectedNumber, setPreSelectedNumber] = useState<{ id: string; number: string } | null>(null);
  const searchParams = useSearchParams();

  const fetchDocuments = useCallback(async (cat = "all") => {
    setLoading(true);
    const url = cat === "all" ? "/api/documents" : `/api/documents?category=${cat}`;
    const res = await fetch(url);
    const data = await res.json();
    setDocuments(data.documents || []);
    if (cat === "all") setActiveCategories(data.activeCategories || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocuments("all"); }, [fetchDocuments]);

  // Handle redirect dari halaman Nomor Surat
  useEffect(() => {
    const shouldUpload = searchParams.get("upload");
    const numberId = searchParams.get("number_id");
    const numberStr = searchParams.get("number");
    if (shouldUpload === "1" && numberId && numberStr) {
      setPreSelectedNumber({ id: numberId, number: decodeURIComponent(numberStr) });
      setShowUpload(true);
    }
  }, [searchParams]);

  const handleCategoryClick = (cat: string) => { setActiveCategory(cat); setPage(1); fetchDocuments(cat); };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const sorted = [...documents].sort((a, b) => {
    let va: string | number = a[sortKey as keyof Document] as string ?? "";
    let vb: string | number = b[sortKey as keyof Document] as string ?? "";
    if (sortKey === "file_size") { va = Number(va); vb = Number(vb); }
    else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);
  const today = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  const statCards = [
    { label: "Total Dokumen", value: documents.length, color: "#0344D8", cat: "all" },
    ...activeCategories.map(cat => ({
      label: CATEGORY_LABELS[cat] || cat,
      value: documents.filter(d => d.category === cat).length,
      color: CAT_COLORS[cat]?.color || "#9CA3AF",
      cat,
    })),
  ].slice(0, 4);

  const ColHeader = ({ label, col }: { label: string; col: SortKey }) => (
    <span onClick={() => handleSort(col)}
      style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 3 }}>
      {label}
      <span style={{ opacity: sortKey === col ? 1 : 0.3, fontSize: 10 }}>
        {sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </span>
  );

  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Dokumen</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>{today}</span>
            <Image src="/arranet-logo-black.png" alt="Arranetwork" width={90} height={22} style={{ opacity: 0.35 }} />
            {canUpload && (
              <button onClick={() => setShowUpload(!showUpload)}
                style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: showUpload ? "#F3F4F6" : "#0344D8", color: showUpload ? "#374151" : "white", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {showUpload ? "✕ Tutup" : "+ Upload"}
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: "20px 28px" }}>
          {/* Upload panel */}
          {showUpload && canUpload && (
            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <p style={{ fontWeight: 600, color: "#1A1F2E", margin: "0 0 14px", fontSize: 14 }}>Upload Dokumen Baru</p>
              {preSelectedNumber && (
                <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🔗</span>
                  <p style={{ fontSize: 12, color: "#16A34A", margin: 0, fontWeight: 500 }}>
                    Dokumen ini akan otomatis di-link ke nomor surat <strong>{preSelectedNumber.number}</strong>
                  </p>
                  <button onClick={() => setPreSelectedNumber(null)}
                    style={{ marginLeft: "auto", background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
              )}
              <DocumentUpload
                onSuccess={() => { setShowUpload(false); setPreSelectedNumber(null); fetchDocuments("all"); setActiveCategory("all"); setPage(1); }}
                preSelectedNumberId={preSelectedNumber?.id}
              />
            </div>
          )}

          {/* Stat cards */}
          {statCards.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${statCards.length}, 1fr)`, gap: 12, marginBottom: 20 }}>
              {statCards.map(stat => (
                <div key={stat.label} onClick={() => handleCategoryClick(stat.cat)}
                  style={{ backgroundColor: "white", border: `1px solid ${activeCategory === stat.cat ? stat.color : "#EFEFEF"}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
                  <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 4px" }}>{stat.label}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: stat.color, margin: 0 }}>{stat.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filter + page size */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => handleCategoryClick("all")}
                style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer", fontFamily: "inherit", backgroundColor: activeCategory === "all" ? "#0344D8" : "white", color: activeCategory === "all" ? "white" : "#6B7280", borderColor: activeCategory === "all" ? "#0344D8" : "#E5E7EB" }}>
                Semua
              </button>
              {activeCategories.map(cat => (
                <button key={cat} onClick={() => handleCategoryClick(cat)}
                  style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer", fontFamily: "inherit", backgroundColor: activeCategory === cat ? CAT_COLORS[cat]?.color : "white", color: activeCategory === cat ? "white" : "#6B7280", borderColor: activeCategory === cat ? CAT_COLORS[cat]?.color : "#E5E7EB" }}>
                  {CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>Tampilkan</span>
              {PAGE_SIZE_OPTIONS.map(n => (
                <button key={n} onClick={() => { setPageSize(n); setPage(1); }}
                  style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer", fontFamily: "inherit", backgroundColor: pageSize === n ? "#1A1F2E" : "white", color: pageSize === n ? "white" : "#6B7280", borderColor: pageSize === n ? "#1A1F2E" : "#E5E7EB" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Document list */}
          <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 120px 90px 70px", gap: 10, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA" }}>
              <ColHeader label="Dokumen" col="title" />
              <ColHeader label="Klasifikasi" col="classification" />
              <ColHeader label="Kategori" col="category" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Diupload oleh</span>
              <ColHeader label="Tgl Upload" col="created_at" />
              <ColHeader label="Ukuran" col="file_size" />
            </div>

            {loading ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Memuat...</div>
            ) : paginated.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center" }}>
                <p style={{ fontSize: 32, margin: "0 0 8px" }}>📂</p>
                <p style={{ fontWeight: 600, color: "#6B7280", margin: 0 }}>
                  {activeCategory === "all" ? "Belum ada dokumen" : `Tidak ada dokumen kategori ${CATEGORY_LABELS[activeCategory as DocumentCategory] || activeCategory}`}
                </p>
                {activeCategory === "all" && canUpload && (
                  <button onClick={() => setShowUpload(true)}
                    style={{ marginTop: 12, color: "#0344D8", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit" }}>
                    Upload sekarang →
                  </button>
                )}
              </div>
            ) : (
              paginated.map((doc, i) => {
                const catStyle = CAT_COLORS[doc.category] || CAT_COLORS.lainnya;
                const clsStyle = CLS_CFG[doc.classification] || CLS_CFG.internal;
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <div key={doc.id}
                    onClick={() => setSelectedDoc(isSelected ? null : doc)}
                    style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 120px 90px 70px", gap: 10, padding: "12px 16px", borderBottom: i < paginated.length - 1 ? "1px solid #F5F5F5" : "none", backgroundColor: isSelected ? "#F0F5FF" : "white", cursor: "pointer", alignItems: "flex-start", transition: "background 0.1s" }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#FAFBFF"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "white"; }}
                  >
                    {/* Title + summary + tags */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1F2E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</p>
                      {doc.is_scanned && (
                        <span title="Dokumen scan — analisis terbatas" style={{ fontSize: 10, fontWeight: 600, backgroundColor: "#FFFBEB", color: "#D97706", padding: "1px 5px", borderRadius: 4, flexShrink: 0, cursor: "help" }}>📷</span>
                      )}
                    </div>
                      {doc.summary && <p style={{ fontSize: 11, color: "#6B7280", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.summary}</p>}
                      {doc.tags?.length > 0 && (
                        <div style={{ display: "flex", gap: 3 }}>
                          {doc.tags.slice(0, 2).map(tag => (
                            <span key={tag} style={{ fontSize: 10, backgroundColor: "#F3F4F6", color: "#6B7280", padding: "1px 5px", borderRadius: 4 }}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Klasifikasi */}
                    <div style={{ paddingTop: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: clsStyle.bg, color: clsStyle.color, padding: "2px 6px", borderRadius: 4 }}>
                        {clsStyle.label}
                      </span>
                    </div>
                    {/* Kategori */}
                    <div style={{ paddingTop: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: catStyle.bg, color: catStyle.color, padding: "2px 6px", borderRadius: 4 }}>
                        {CATEGORY_LABELS[doc.category] || doc.category}
                      </span>
                    </div>
                    {/* Uploader */}
                    <span style={{ fontSize: 11, color: "#6B7280", paddingTop: 2 }}>{doc.uploader_name || "—"}</span>
                    {/* Tgl Upload */}
                    <span style={{ fontSize: 11, color: "#6B7280", paddingTop: 2 }}>{formatDate(doc.created_at)}</span>
                    {/* Ukuran */}
                    <span style={{ fontSize: 11, color: "#9CA3AF", paddingTop: 2 }}>{formatSize(doc.file_size)}</span>

                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} dari {sorted.length} dokumen
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setPage(1)} disabled={page === 1}
                  style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E5E7EB", backgroundColor: "white", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: 12, color: page === 1 ? "#D1D5DB" : "#374151", fontFamily: "inherit" }}>«</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E5E7EB", backgroundColor: "white", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: 12, color: page === 1 ? "#D1D5DB" : "#374151", fontFamily: "inherit" }}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) => p === "..." ? (
                    <span key={`e-${i}`} style={{ padding: "5px 8px", fontSize: 12, color: "#9CA3AF" }}>…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p as number)}
                      style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid", fontSize: 12, fontFamily: "inherit", cursor: "pointer", backgroundColor: page === p ? "#0344D8" : "white", color: page === p ? "white" : "#374151", borderColor: page === p ? "#0344D8" : "#E5E7EB", fontWeight: page === p ? 600 : 400 }}>
                      {p}
                    </button>
                  ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E5E7EB", backgroundColor: "white", cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: 12, color: page === totalPages ? "#D1D5DB" : "#374151", fontFamily: "inherit" }}>›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E5E7EB", backgroundColor: "white", cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: 12, color: page === totalPages ? "#D1D5DB" : "#374151", fontFamily: "inherit" }}>»</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side Panel */}
      <DocumentSidePanel
        document={selectedDoc}
        uploaderName={selectedDoc?.uploader_name}
        onClose={() => setSelectedDoc(null)}
      />
    </>
  );
}
