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
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentCardProps {
  document: Document;
  onDelete?: (id: string) => void;
}

export default function DocumentCard({ document: doc, onDelete }: DocumentCardProps) {
  const catStyle = CAT_COLORS[doc.category] || CAT_COLORS.lainnya;

  const handleDownload = async () => {
    const res = await fetch(`/api/documents/${doc.id}/download`);
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  };

  return (
    <div
      style={{ backgroundColor: "white", border: "1px solid #F0F0F0", borderRadius: 16, padding: 18, transition: "box-shadow 0.15s", fontFamily: "'DM Sans', system-ui, sans-serif" }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.07)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      {/* Top */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>
          📄
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 13, color: "#1A1F2E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {doc.title}
          </p>
          {doc.summary && (
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
              {doc.summary}
            </p>
          )}
        </div>
      </div>

      {/* Category + tags */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ backgroundColor: catStyle.bg, color: catStyle.color, padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
          {CATEGORY_LABELS[doc.category]}
        </span>
        {doc.tags?.slice(0, 2).map((tag) => (
          <span key={tag} style={{ backgroundColor: "#F3F4F6", color: "#6B7280", padding: "3px 9px", borderRadius: 6, fontSize: 11 }}>
            {tag}
          </span>
        ))}
      </div>

      {/* AI confidence bar */}
      {doc.category_confidence > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ height: 3, backgroundColor: "#F3F4F6", borderRadius: 4 }}>
            <div style={{ height: 3, backgroundColor: "#D1EA2C", borderRadius: 4, width: `${doc.category_confidence * 100}%`, transition: "width 0.4s ease" }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{formatDate(doc.created_at)}</p>
          <p style={{ fontSize: 11, color: "#D1D5DB", margin: 0 }}>{formatSize(doc.file_size)}</p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={handleDownload}
            title="Download"
            style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #E5E7EB", backgroundColor: "white", cursor: "pointer", fontSize: 13 }}
          >
            ↓
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(doc.id)}
              title="Hapus"
              style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #FEE2E2", backgroundColor: "white", cursor: "pointer", color: "#EF4444", fontSize: 13 }}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
