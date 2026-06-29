"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useToast } from "@/components/ui/Toast";
import { toFriendlyError } from "@/lib/errors/friendlyMessage";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isLimitNotice?: boolean;
}

interface Usage {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
}

const SUGGESTIONS = [
  "Ada berapa dokumen restricted yang belum ada nomor surat?",
  "Dokumen apa saja yang akan kadaluarsa 30 hari ke depan?",
  "Berapa total dokumen yang sudah diupload bulan ini?",
  "Kontrak apa saja yang melibatkan PT Inova Care Indonesia?",
];

export default function AssistantPage() {
  const { error: toastError } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai-assistant")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setUsage)
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const quotaExhausted = usage && !usage.isUnlimited && usage.remaining <= 0;

  const handleSend = async (questionOverride?: string) => {
    const question = (questionOverride ?? input).trim();
    if (!question || sending || quotaExhausted) return;

    const history = messages.filter(m => !m.isLimitNotice).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json();

      if (res.status === 429 && data.limitReached) {
        setMessages(prev => [...prev, { role: "assistant", content: data.error, isLimitNotice: true }]);
        setUsage(prev => prev ? { ...prev, remaining: 0 } : prev);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Gagal mendapat jawaban");

      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
      if (data.usage) setUsage(data.usage);
    } catch (err) {
      const friendly = toFriendlyError(err, "process");
      toastError(friendly.message);
      setMessages(prev => prev.slice(0, -1)); // batalkan bubble pertanyaan user kalau gagal total
      setInput(question);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>🤖 Tanya CLARA</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>Tanya apa saja soal arsip — dokumen, nomor surat, statistik</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {usage && (
            <span style={{ fontSize: 12, fontWeight: 600, color: quotaExhausted ? "#DC2626" : "#6B7280", backgroundColor: quotaExhausted ? "#FEF2F2" : "#F3F4F6", padding: "5px 12px", borderRadius: 8 }}>
              {usage.isUnlimited ? "∞ Unlimited" : `${usage.remaining}/${usage.limit} pertanyaan tersisa hari ini`}
            </span>
          )}
          <Image src="/arranet-logo-black.png" alt="Arranetwork" width={90} height={22} style={{ opacity: 0.35 }} />
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "#9CA3AF" }}>
            <p style={{ fontSize: 36, margin: 0 }}>🤖</p>
            <p style={{ fontSize: 13, margin: 0, textAlign: "center", maxWidth: 360 }}>
              Halo — saya bisa bantu jawab soal arsip dokumen, nomor surat, dan statistik CLARA. Coba salah satu ini:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 420 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => handleSend(s)} disabled={!!quotaExhausted}
                  style={{ textAlign: "left", fontSize: 12.5, color: "#0344D8", backgroundColor: "#EEF2FF", border: "1px solid #E0E7FF", borderRadius: 10, padding: "10px 14px", cursor: quotaExhausted ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: quotaExhausted ? 0.5 : 1 }}>
                  &ldquo;{s}&rdquo;
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "75%", padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
                backgroundColor: m.isLimitNotice ? "#FFFBEB" : m.role === "user" ? "#0344D8" : "white",
                color: m.isLimitNotice ? "#92400E" : m.role === "user" ? "white" : "#1A1F2E",
                border: m.role === "assistant" && !m.isLimitNotice ? "1px solid #EFEFEF" : m.isLimitNotice ? "1px solid #FDE68A" : "none",
              }}>
                {m.isLimitNotice && <span style={{ marginRight: 6 }}>⏳</span>}
                {m.content}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "10px 14px", borderRadius: 14, backgroundColor: "white", border: "1px solid #EFEFEF", fontSize: 13, color: "#9CA3AF" }}>
              ⏳ CLARA sedang mikir...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "14px 28px", borderTop: "1px solid #EFEFEF", backgroundColor: "white", flexShrink: 0 }}>
        {quotaExhausted ? (
          <p style={{ fontSize: 12, color: "#DC2626", textAlign: "center", margin: 0 }}>
            ⏳ Batas pertanyaan harian tercapai. Reset besok pukul 00:00.
          </p>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Tanya soal dokumen, nomor surat, atau statistik arsip..."
              disabled={sending}
              style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 12, padding: "11px 16px", fontSize: 13, fontFamily: "inherit", outline: "none" }}
            />
            <button onClick={() => handleSend()} disabled={sending || !input.trim()}
              style={{ backgroundColor: "#0344D8", color: "white", border: "none", borderRadius: 12, padding: "0 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: sending || !input.trim() ? 0.5 : 1 }}>
              Kirim
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
