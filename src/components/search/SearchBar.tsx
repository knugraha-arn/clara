"use client";

import { useState, useCallback } from "react";
import { Search, Sparkles, Loader2 } from "lucide-react";
import DocumentCard from "@/components/documents/DocumentCard";
import type { SearchResult } from "@/types";
import { cn } from "@/lib/utils";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const isConceptual = query.trim().split(" ").length > 3;

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          {isConceptual ? (
            <Sparkles className="w-5 h-5 text-[#0344D8]" />
          ) : (
            <Search className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
          placeholder="Cari dokumen... (contoh: 'kontrak kerja sama IT tahun lalu')"
          className="w-full pl-12 pr-32 py-4 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0344D8] focus:border-transparent shadow-sm"
        />
        <div className="absolute inset-y-0 right-3 flex items-center gap-2">
          {isConceptual && (
            <span className="text-xs bg-[#D1EA2C] text-[#1A1F2E] px-2 py-0.5 rounded-full font-medium">
              AI Search
            </span>
          )}
          <button
            onClick={() => handleSearch(query)}
            disabled={loading || !query.trim()}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-semibold transition-colors",
              "bg-[#0344D8] hover:bg-[#387EE4] text-white disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cari"}
          </button>
        </div>
      </div>

      {/* Hint */}
      {!searched && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Exact Match", desc: "Nomor surat, nama file, kata kunci spesifik", icon: "🔍" },
            { label: "AI Semantic", desc: "Deskripsi konseptual seperti 'kontrak yang bermasalah'", icon: "✨" },
          ].map((hint) => (
            <div key={hint.label} className="bg-white border border-gray-100 rounded-xl p-4 flex gap-3">
              <span className="text-xl">{hint.icon}</span>
              <div>
                <p className="text-sm font-semibold text-[#1A1F2E]">{hint.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{hint.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {results.length > 0
                ? `${results.length} dokumen ditemukan`
                : "Tidak ada dokumen yang cocok"}
            </p>
            {results.length > 0 && (
              <div className="flex gap-2 text-xs">
                {["exact", "semantic", "hybrid"].map((type) => {
                  const count = results.filter((r) => r.match_type === type).length;
                  if (count === 0) return null;
                  return (
                    <span key={type} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {count} {type}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {results.map((result) => (
              <div key={result.document.id} className="relative">
                <DocumentCard document={result.document} />
                {result.snippet && (
                  <div className="mt-1 px-5 pb-3 -mt-2 bg-white rounded-b-xl border-x border-b border-gray-100">
                    <p className="text-xs text-gray-400 italic line-clamp-2">&quot;{result.snippet}&quot;</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
