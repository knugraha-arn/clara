"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

interface ChatMessage { role: "user" | "assistant"; content: string; hasContext?: boolean; }
interface SearchResultWithUploader extends SearchResult { uploader_name?: string; }

export default function SearchPage() {
  const [activeTab, setActiveTab] = useState<"search" | "ai">("search");

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultWithUploader[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedUploaderName, setSelectedUploaderName] = useState<string | undefined>();

  // AI Assistant state
  const [aiInput, setAiInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Search
  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearchLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch { setResults([]); }
    finally { setSearchLoading(false); }
  }, []);

  // AI Assistant
  const handleAiSend = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const question = aiInput.trim();
    setAiInput("");
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setAiLoading(true);

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: messages.slice(-6),
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer || "Maaf, tidak dapat memproses pertanyaan ini.",
        hasContext: data.hasContext,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Terjadi kesalahan. Coba lagi." }]);
    }
    setAiLoading(false);
  };

  const isAI = query.trim().length > 2;

  return (
    <>
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Pencarian & AI Assistant</h1>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #EFEFEF", backgroundColor: "white", padding: "0 28px" }}>
          {[
            { key: "search", label: "🔍 Pencarian Dokumen" },
            { key: "ai", label: "💬 Tanya AI" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as "search" | "ai")}
              style={{ padding: "12px 20px", border: "none", borderBottom: `2px solid ${activeTab === tab.key ? "#0344D8" : "transparent"}`, backgroundColor: "transparent", color: activeTab === tab.key ? "#0344D8" : "#6B7280", fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "20px 28px" }}>
          {/* SEARCH TAB */}
          {activeTab === "search" && (
            <div>
              <div style={{ position: "relative", marginBottom: 20 }}>
                <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>
                  {isAI ? "✨" : "🔍"}
                </div>
                <input type="text" value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
                  placeholder="Cari dokumen... misal: 'kontrak kerja sama IT yang bermasalah'"
                  style={{ width: "100%", padding: "13px 130px 13px 44px", borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 14, fontFamily: "inherit", backgroundColor: "white", outline: "none", boxSizing: "border-box" }}
                />
                <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 6, alignItems: "center" }}>
                  {isAI && <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: "#D1EA2C", color: "#1A1F2E", padding: "3px 8px", borderRadius: 5 }}>AI</span>}
                  <button onClick={() => handleSearch(query)} disabled={searchLoading || !query.trim()}
                    style={{ backgroundColor: "#0344D8", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: searchLoading || !query.trim() ? 0.5 : 1 }}>
                    {searchLoading ? "..." : "Cari"}
                  </button>
                </div>
              </div>

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

              {searched && (
                <div>
                  <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 12 }}>
                    {searchLoading ? "Mencari..." : `${results.length} dokumen ditemukan`}
                  </p>
                  {!searchLoading && results.length > 0 && (
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
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#FAFBFF"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? "#F0F5FF" : "white"; }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1F2E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</p>
                                <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: result.match_type === "semantic" ? "#EEF2FF" : "#F0FDF4", color: result.match_type === "semantic" ? "#0344D8" : "#16A34A", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>
                                  {result.match_type}
                                </span>
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
                </div>
              )}
            </div>
          )}

          {/* AI ASSISTANT TAB */}
          {activeTab === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
              {/* Info banner */}
              <div style={{ backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#0344D8", margin: "0 0 2px" }}>CLARA AI Assistant</p>
                  <p style={{ fontSize: 12, color: "#3730A3", margin: 0 }}>
                    Tanya tentang dokumen di arsip CLARA. Contoh: "Kontrak apa saja yang akan expired tahun ini?", "Dokumen apa yang berhubungan dengan KB Bank?", "Ringkaskan kebijakan WFH yang ada"
                  </p>
                </div>
              </div>

              {/* Chat messages */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF" }}>
                    <p style={{ fontSize: 32, margin: "0 0 8px" }}>💬</p>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>Mulai percakapan dengan CLARA AI</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>Tanya apapun tentang dokumen di arsip</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    {msg.role === "assistant" && (
                      <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "#0344D8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginRight: 8, alignSelf: "flex-end" }}>
                        💬
                      </div>
                    )}
                    <div style={{
                      maxWidth: "70%",
                      backgroundColor: msg.role === "user" ? "#0344D8" : "white",
                      color: msg.role === "user" ? "white" : "#1A1F2E",
                      border: msg.role === "assistant" ? "1px solid #EFEFEF" : "none",
                      borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      padding: "10px 14px",
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}>
                      {msg.content}
                      {msg.role === "assistant" && msg.hasContext && (
                        <p style={{ fontSize: 10, color: "#9CA3AF", margin: "6px 0 0", borderTop: "1px solid #F3F4F6", paddingTop: 4 }}>
                          ✨ Berdasarkan dokumen di arsip CLARA
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "#0344D8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>💬</div>
                    <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: "16px 16px 16px 4px", padding: "10px 16px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[0, 1, 2].map(j => (
                          <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#9CA3AF", animation: `pulse 1s ${j * 0.2}s infinite` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAiSend()}
                  placeholder="Tanya tentang dokumen di arsip... (Enter untuk kirim)"
                  disabled={aiLoading}
                  style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 16px", fontSize: 13, fontFamily: "inherit", outline: "none", opacity: aiLoading ? 0.6 : 1 }}
                />
                <button onClick={handleAiSend} disabled={aiLoading || !aiInput.trim()}
                  style={{ backgroundColor: "#0344D8", color: "white", border: "none", borderRadius: 12, padding: "12px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: aiLoading || !aiInput.trim() ? 0.5 : 1 }}>
                  Kirim
                </button>
                {messages.length > 0 && (
                  <button onClick={() => setMessages([])}
                    style={{ backgroundColor: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    Reset
                  </button>
                )}
              </div>
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
