"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, FolderOpen, FileText, LayoutGrid, List } from "lucide-react";
import DocumentUpload from "@/components/documents/DocumentUpload";
import DocumentCard from "@/components/documents/DocumentCard";
import { CATEGORY_LABELS } from "@/lib/utils";
import type { Document } from "@/types";

const CATEGORIES = [
  { value: "all", label: "Semua" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1A1F2E]">Dokumen</h1>
          <p className="text-sm text-gray-400 mt-0.5">{documents.length} dokumen tersimpan</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${
            showUpload
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-[#0344D8] hover:bg-[#387EE4] text-white"
          }`}
        >
          {showUpload ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showUpload ? "Tutup" : "Upload"}
        </button>
      </div>

      {/* Upload Panel */}
      {showUpload && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-[#0344D8]/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#0344D8]" />
            </div>
            <h2 className="font-semibold text-[#1A1F2E]">Upload Dokumen Baru</h2>
          </div>
          <DocumentUpload onSuccess={() => { setShowUpload(false); fetchDocuments(); }} />
        </div>
      )}

      {/* Filters + View Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5 overflow-x-auto flex-1 pb-0.5 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCategory === cat.value
                  ? "bg-[#0344D8] text-white"
                  : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 shrink-0 bg-white">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-gray-100 text-gray-800" : "text-gray-400 hover:text-gray-600"}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-gray-100 text-gray-800" : "text-gray-400 hover:text-gray-600"}`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Documents */}
      {loading ? (
        <div className={`grid gap-3 ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
              <div className="flex gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-24 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto">
            <FolderOpen className="w-7 h-7 text-gray-400" />
          </div>
          <p className="font-semibold text-gray-500">Belum ada dokumen</p>
          <p className="text-sm text-gray-400">Upload PDF pertama Anda untuk memulai</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-2 text-sm text-[#0344D8] hover:underline font-medium"
          >
            Upload sekarang →
          </button>
        </div>
      ) : (
        <div className={`grid gap-3 ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
          {documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
