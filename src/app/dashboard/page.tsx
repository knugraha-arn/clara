"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, FolderOpen } from "lucide-react";
import DocumentUpload from "@/components/documents/DocumentUpload";
import DocumentCard from "@/components/documents/DocumentCard";
import { CATEGORY_LABELS } from "@/lib/utils";
import type { Document, DocumentCategory } from "@/types";

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "all", label: "Semua" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const url = activeCategory === "all"
      ? "/api/documents"
      : `/api/documents?category=${activeCategory}`;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1F2E]">Dokumen Saya</h1>
          <p className="text-sm text-gray-500 mt-0.5">{documents.length} dokumen tersimpan</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 bg-[#0344D8] hover:bg-[#387EE4] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
        >
          {showUpload ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showUpload ? "Tutup" : "Upload Dokumen"}
        </button>
      </div>

      {/* Upload Panel */}
      {showUpload && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-[#1A1F2E] mb-4">Upload Dokumen Baru</h2>
          <DocumentUpload onSuccess={() => { setShowUpload(false); fetchDocuments(); }} />
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.value
                ? "bg-[#0344D8] text-white"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Documents Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="font-medium text-gray-500">Belum ada dokumen</p>
          <p className="text-sm text-gray-400">Upload dokumen PDF pertama Anda</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-2 text-sm text-[#0344D8] hover:underline"
          >
            Upload sekarang
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
