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

// Generate unique file path untuk storage
export function generateStoragePath(userId: string, fileName: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();
  const ext = fileName.split(".").pop() || "pdf";
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 50);
  return `${userId}/${year}/${month}/${uuid}-${safeName}.${ext}`;
}
