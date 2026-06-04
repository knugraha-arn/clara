"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import DocumentSidePanel from "@/components/documents/DocumentSidePanel";
import { useRole } from "@/components/layout/DashboardShell";
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

const ROLE_LIMITS: Record<string, number> = {
  auditor: 20, contributor: 30, admin: 50, super_admin: 999999,
};

const SUGGESTION_PILLS = [
  "Kontrak apa saja yang melibatkan PT Karvelo?",
  "Dokumen apa yang akan expired bulan ini?",
  "Ada berapa dokumen Confidential di arsip?",
  "Siapa yang paling banyak upload dokumen?",
  "Dokumen apa saja yang diupload minggu ini?",
  "Ringkaskan kebijakan yang ada di arsip",
];

function formatDate(d: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

interface ChatMessage { role: "user" | "assistant"; content: string; hasContext?: boolean; }
interface SearchResultWithUploader extends SearchResult { uploader_name?: string; }
interface UsageData { used: number; limit: number; remaining: number; }

export default function SearchPage() {
  const role = useRole();
  const [activeTab, setActiveTab] = useState<"ai" | "search">("ai");

  // AI state
  const [aiInput, setAiInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [usage, setUsage] = useState<UsageData>({ used: 0, limit: ROLE_LIMITS[role] || 30, remaining: ROLE_LIMITS[role] || 30 });
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultWithUploader[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedUploaderName, setSelectedUploaderName] = useState<string | undefined>();

  // Load usage on mount
  useEffect(() => {
    fetch("/api/ai-assistant").then(r => r.json()).then(d => {
      if (d.limit) setUsage(d);
    });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAiSend = async (question?: string) => {
    const q = (question || aiInput).trim();
    if (!q || aiLoading) return;
    setAiInput("");
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setAiLoading(true);

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: messages.slice(-6) }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.answer, hasContext: data.hasContext }]);
        if (data.usage) setUsage(data.usage);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Terjadi kesalahan. Coba lagi." }]);
    }
    setAiLoading(false);
  };

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

  const isUnlimited = role === "super_admin";
  const usagePct = isUnlimited ? 0 : (usage.used / usage.limit) * 100;

  return (
    <>
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", height: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white", flexShrink: 0 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>AI Assistance</h1>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #EFEFEF", backgroundColor: "white", padding: "0 28px", flexShrink: 0 }}>
          {[
            { key: "ai", label: "💬 Tanya AI" },
            { key: "search", label: "🔍 Pencarian Dokumen" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as "ai" | "search")}
              style={{ padding: "11px 20px", border: "none", borderBottom: `2px solid ${activeTab === tab.key ? "#0344D8" : "transparent"}`, backgroundColor: "transparent", color: activeTab === tab.key ? "#0344D8" : "#6B7280", fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* AI TAB */}
        {activeTab === "ai" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Chat area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Chat header */}
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #F0F0F0", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#0344D8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💬</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1F2E" }}>CLARA AI Assistant</span>
                    <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: "#D1EA2C", color: "#1A1F2E", padding: "2px 8px", borderRadius: 999 }}>AI Powered</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>Berbasis data arsip dokumen CLARA</span>
                </div>
                {!isUnlimited && (
                  <div style={{ marginLeft: "auto", fontSize: 12, color: "#9CA3AF", textAlign: "right" }}>
                    <span style={{ fontWeight: 700, color: usage.remaining < 5 ? "#DC2626" : "#1A1F2E", fontSize: 14 }}>{usage.used}/{usage.limit}</span>
                    <span style={{ marginLeft: 4 }}>pertanyaan digunakan</span>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", paddingTop: 20 }}>
                    <p style={{ fontSize: 22, color: "#9CA3AF", marginBottom: 6 }}>✦</p>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "#6B7280", marginBottom: 4 }}>Ajukan pertanyaan tentang arsip dokumen CLARA</p>
                    <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 24 }}>AI menjawab dalam bahasa natural · Bukan untuk pencarian dokumen</p>
                    {/* Suggestion pills */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 600, margin: "0 auto" }}>
                      {SUGGESTION_PILLS.map(pill => (
                        <button key={pill} onClick={() => handleAiSend(pill)}
                          style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid #E5E7EB", backgroundColor: "white", color: "#374151", fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0344D8"; e.currentTarget.style.color = "#0344D8"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}>
                          {pill}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                    {msg.role === "assistant" && (
                      <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#0344D8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>💬</div>
                    )}
                    <div style={{
                      maxWidth: "72%",
                      backgroundColor: msg.role === "user" ? "#0344D8" : "white",
                      color: msg.role === "user" ? "white" : "#1A1F2E",
                      border: msg.role === "assistant" ? "1px solid #EFEFEF" : "none",
                      borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      padding: "10px 14px",
                      fontSize: 13,
                      lineHeight: 1.65,
                      whiteSpace: "pre-wrap",
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
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#0344D8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>💬</div>
                    <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: "16px 16px 16px 4px", padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {[0, 1, 2].map(j => (
                          <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#9CA3AF", opacity: 0.6 }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "16px 24px", borderTop: "1px solid #F0F0F0", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAiSend()}
                    placeholder="Tanya tentang arsip... misal: 'Kontrak apa yang melibatkan PT X?' atau 'Dokumen apa yang expired bulan ini?'"
                    disabled={aiLoading || usage.remaining === 0}
                    style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 12, padding: "11px 16px", fontSize: 13, fontFamily: "inherit", outline: "none", opacity: aiLoading || usage.remaining === 0 ? 0.6 : 1 }}
                  />
                  <button onClick={() => handleAiSend()} disabled={aiLoading || !aiInput.trim() || usage.remaining === 0}
                    style={{ backgroundColor: "#0344D8", color: "white", border: "none", borderRadius: 12, padding: "11px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: aiLoading || !aiInput.trim() || usage.remaining === 0 ? 0.5 : 1 }}>
                    Kirim
                  </button>
                  {messages.length > 0 && (
                    <button onClick={() => setMessages([])}
                      style={{ backgroundColor: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 12, padding: "11px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      Reset
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "6px 0 0" }}>
                  Scope terbatas pada arsip dokumen CLARA · Tidak dapat menjawab pertanyaan di luar konteks arsip
                </p>
              </div>
            </div>

            {/* Right panel — scope + usage */}
            <div style={{ width: 240, borderLeft: "1px solid #F0F0F0", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16, flexShrink: 0, overflowY: "auto" }}>
              {/* Usage */}
              {!isUnlimited && (
                <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 12, padding: "14px" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", margin: "0 0 8px" }}>Penggunaan Hari Ini</p>
                  <p style={{ fontSize: 30, fontWeight: 800, color: usage.remaining < 5 ? "#DC2626" : "#1A1F2E", margin: "0 0 2px", letterSpacing: "-1px" }}>
                    {usage.used} <span style={{ fontSize: 16, color: "#9CA3AF", fontWeight: 400 }}>/ {usage.limit}</span>
                  </p>
                  <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 8px" }}>pertanyaan digunakan hari ini</p>
                  <div style={{ height: 4, backgroundColor: "#F3F4F6", borderRadius: 4 }}>
                    <div style={{ height: 4, backgroundColor: usagePct > 80 ? "#DC2626" : "#0344D8", borderRadius: 4, width: `${Math.min(usagePct, 100)}%`, transition: "width 0.3s ease" }} />
                  </div>
                </div>
              )}

              {/* Scope */}
              <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 12, padding: "14px" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", margin: "0 0 10px" }}>Scope Data</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { ok: true,  label: "Info & metadata dokumen" },
                    { ok: true,  label: "Kategori & klasifikasi" },
                    { ok: true,  label: "Status retensi" },
                    { ok: true,  label: "Statistik arsip" },
                    { ok: true,  label: "Rekomendasi tindakan" },
                    { ok: false, label: "Data di luar CLARA" },
                    { ok: false, label: "Generate kode/artefak" },
                    { ok: false, label: "Akses internet" },
                  ].map(item => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: item.ok ? "#16A34A" : "#DC2626", flexShrink: 0 }}>{item.ok ? "✓" : "✗"}</span>
                      <span style={{ fontSize: 12, color: item.ok ? "#374151" : "#9CA3AF" }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div style={{ backgroundColor: "#F0F5FF", border: "1px solid #C7D2FE", borderRadius: 12, padding: "14px" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#0344D8", margin: "0 0 6px" }}>Tips</p>
                <p style={{ fontSize: 11, color: "#3730A3", margin: 0, lineHeight: 1.6 }}>
                  Gunakan pertanyaan spesifik untuk hasil lebih akurat. Contoh: sebutkan kategori atau nama dokumen yang dicari.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SEARCH TAB */}
        {activeTab === "search" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <input type="text" value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
                placeholder="Cari dokumen... misal: 'kontrak kerja sama IT yang bermasalah'"
                style={{ width: "100%", padding: "13px 130px 13px 44px", borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 14, fontFamily: "inherit", backgroundColor: "white", outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</div>
              <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 6, alignItems: "center" }}>
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
                              <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: result.match_type === "semantic" ? "#EEF2FF" : "#F0FDF4", color: result.match_type === "semantic" ? "#0344D8" : "#16A34A", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>{result.match_type}</span>
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
      </div>

      <DocumentSidePanel
        document={selectedDoc}
        uploaderName={selectedUploaderName}
        onClose={() => { setSelectedDoc(null); setSelectedUploaderName(undefined); }}
      />
    </>
  );
}
