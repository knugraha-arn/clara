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
  surat_masuk: "Surat Masuk",
  surat_keluar: "Surat Keluar",
  kontrak: "Kontrak",
  memo: "Memo",
  laporan: "Laporan",
  kebijakan: "Kebijakan",
  undangan: "Undangan",
  pengumuman: "Pengumuman",
  lainnya: "Lainnya",
};

export const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  surat_masuk: "bg-blue-100 text-blue-700",
  surat_keluar: "bg-lime-100 text-lime-700",
  kontrak: "bg-amber-100 text-amber-700",
  memo: "bg-gray-100 text-gray-700",
  laporan: "bg-indigo-100 text-indigo-700",
  kebijakan: "bg-red-100 text-red-700",
  undangan: "bg-pink-100 text-pink-700",
  pengumuman: "bg-orange-100 text-orange-700",
  lainnya: "bg-gray-100 text-gray-500",
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
