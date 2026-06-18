import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DocumentCategory } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateString));
}

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  surat_masuk:     "Surat Masuk",
  surat_keluar:    "Surat Keluar",
  kontrak:         "Kontrak",
  nda:             "NDA",
  memo:            "Memo",
  prosedur:        "Prosedur",
  kebijakan:       "Kebijakan",
  instruksi_kerja: "Instruksi Kerja",
  template:        "Template",
  laporan:         "Laporan",
  undangan:        "Undangan",
  pengumuman:      "Pengumuman",
  invoice:         "Invoice",
  po:              "Purchase Order",
  berita_acara:    "Berita Acara",
  lainnya:         "Lainnya",
};


// ─── Klasifikasi ────────────────────────────────────────────────────────────
export const CLS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  public:       { label: "Public",       color: "#16A34A", bg: "#F0FDF4" },
  internal:     { label: "Internal",     color: "#0344D8", bg: "#EEF2FF" },
  confidential: { label: "Confidential", color: "#D97706", bg: "#FFFBEB" },
  restricted:   { label: "Restricted",   color: "#DC2626", bg: "#FEF2F2" },
};

// ─── Warna Kategori (inline style) ──────────────────────────────────────────
export const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  surat_masuk:    { bg: "#EEF2FF", color: "#0344D8" },
  surat_keluar:   { bg: "#F0FDF4", color: "#16A34A" },
  kontrak:        { bg: "#FFFBEB", color: "#D97706" },
  nda:            { bg: "#FEF2F2", color: "#DC2626" },
  memo:           { bg: "#F9FAFB", color: "#6B7280" },
  prosedur:       { bg: "#F0F9FF", color: "#0369A1" },
  kebijakan:      { bg: "#FEF2F2", color: "#DC2626" },
  instruksi_kerja:{ bg: "#F0FDF4", color: "#059669" },
  template:       { bg: "#F5F3FF", color: "#7C3AED" },
  laporan:        { bg: "#EFF6FF", color: "#2563EB" },
  undangan:       { bg: "#FDF4FF", color: "#9333EA" },
  pengumuman:     { bg: "#FFF7ED", color: "#EA580C" },
  invoice:        { bg: "#FEF2F2", color: "#DC2626" },
  po:             { bg: "#FFF7ED", color: "#C2410C" },
  berita_acara:   { bg: "#ECFEFF", color: "#0891B2" },
  lainnya:        { bg: "#F9FAFB", color: "#9CA3AF" },
};

// ─── Format Helpers ──────────────────────────────────────────────────────────

/** Format bytes → "123 KB" atau "1.2 MB" */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format tanggal pendek: "12 Jun 2025" */
export function formatDateShort(d: string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

/** Format tanggal panjang: "12 Juni 2025" */
export function formatDateLong(d: string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
}

/** Format tanggal + waktu: "12 Juni 2025, 09.30" */
export function formatDateTime(d: string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

// ─── Generate unique file path untuk storage ─────────────────────────────────
export function generateStoragePath(userId: string, fileName: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();
  const ext = fileName.split(".").pop() || "pdf";
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 50);
  return `${userId}/${year}/${month}/${uuid}-${safeName}.${ext}`;
}
