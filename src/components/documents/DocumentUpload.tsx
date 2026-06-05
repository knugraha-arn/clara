"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateStoragePath } from "@/lib/utils";
import type { DocumentClassification } from "@/types";

const CLASSIFICATION_CONFIG: Record<DocumentClassification, { label: string; color: string; bg: string; border: string; desc: string }> = {
  public:       { label: "Public",       color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", desc: "Boleh diketahui publik" },
  internal:     { label: "Internal",     color: "#0344D8", bg: "#EEF2FF", border: "#C7D2FE", desc: "Khusus karyawan" },
  confidential: { label: "Confidential", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", desc: "Terbatas, perlu tahu saja" },
  restricted:   { label: "Restricted",   color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", desc: "Sangat terbatas, board level" },
};

const CATEGORY_OPTIONS = [
  { value: "surat_masuk",  label: "Surat Masuk" },
  { value: "surat_keluar", label: "Surat Keluar" },
  { value: "kontrak",      label: "Kontrak" },
  { value: "memo",         label: "Memo" },
  { value: "laporan",      label: "Laporan" },
  { value: "kebijakan",    label: "Kebijakan" },
  { value: "undangan",     label: "Undangan" },
  { value: "pengumuman",   label: "Pengumuman" },
  { value: "lainnya",      label: "Lainnya" },
];

interface DuplicateDoc {
  id: string; title: string; category: string; classification: string; created_at: string; similarity: number;
}

interface Party { id: string; name: string; }

interface AiSuggestion {
  classification: DocumentClassification;
  classification_confidence: number;
  classification_reason: string;
  category: string;
  summary: string;
  tags: string[];
  is_scanned: boolean;
  documentId: string;
}

interface DocumentUploadProps { onSuccess?: () => void; }

type Stage = "idle" | "uploading" | "analyzing" | "checking" | "confirm" | "saving" | "done" | "error";

export default function DocumentUpload({ onSuccess }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [storagePath, setStoragePath] = useState("");
  const [selectedClassification, setSelectedClassification] = useState<DocumentClassification>("internal");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [customCategory, setCustomCategory] = useState<string>("");
  const [editedSummary, setEditedSummary] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateDoc[]>([]);

  // Party state
  const [parties, setParties] = useState<Party[]>([]);
  const [partyInput, setPartyInput] = useState("");
  const [partySuggestions, setPartySuggestions] = useState<{ id: string; name: string; doc_count: number }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const partyInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  // Fetch party suggestions — trigger dari 1 karakter
  useEffect(() => {
    if (partyInput.length === 0) {
      setPartySuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setShowSuggestions(true); // show dropdown immediately
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/parties?q=${encodeURIComponent(partyInput)}`);
      const data = await res.json();
      setPartySuggestions(data.parties || []);
    }, 150);
    return () => clearTimeout(timeout);
  }, [partyInput]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!suggestionsRef.current?.contains(e.target as Node) && !partyInputRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addParty = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (parties.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return;
    // Add with temp id, will be saved on confirm
    setParties(prev => [...prev, { id: `temp-${Date.now()}`, name: trimmed }]);
    setPartyInput("");
    setShowSuggestions(false);
  };

  const removeParty = (name: string) => {
    setParties(prev => prev.filter(p => p.name !== name));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") {
      setSelectedFile(file);
      if (!title) setTitle(file.name.replace(".pdf", ""));
    }
  }, [title]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title) setTitle(file.name.replace(".pdf", ""));
    }
  };

  const cancelAndDelete = async (documentId: string) => {
    try { await fetch(`/api/documents?id=${documentId}`, { method: "DELETE" }); }
    catch (e) { console.error("Failed to delete cancelled doc:", e); }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      setStage("uploading"); setProgress(15); setMessage("Mengupload file ke storage...");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");

      const path = generateStoragePath(user.id, selectedFile.name);
      const { error: uploadError } = await supabase.storage
        .from("documents").upload(path, selectedFile, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw new Error(`Upload gagal: ${uploadError.message}`);
      setStoragePath(path); setProgress(40);

      setStage("analyzing"); setMessage("AI sedang menganalisis dokumen..."); setProgress(60);

      const res = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: path, fileName: selectedFile.name, fileSize: selectedFile.size, title: title || selectedFile.name.replace(".pdf", ""), classificationOverride: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Proses gagal");

      const documentId = data.document.id;
      setProgress(80);

      setStage("checking"); setMessage("Memeriksa duplikat dokumen...");
      await new Promise(r => setTimeout(r, 2000));

      let foundDuplicates: DuplicateDoc[] = [];
      try {
        const dupRes = await fetch("/api/documents/check-duplicate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        });
        const dupData = await dupRes.json();
        foundDuplicates = dupData.duplicates || [];
      } catch { foundDuplicates = []; }

      setProgress(100);
      setDuplicates(foundDuplicates);
      setAiSuggestion({
        classification: data.document.classification_ai_suggestion || data.document.classification,
        classification_confidence: data.document.classification_confidence,
        classification_reason: data.document.classification_reason,
        category: data.document.category,
        summary: data.document.summary,
        tags: data.document.tags,
        is_scanned: data.document.is_scanned || false,
        documentId,
      });
      setEditedSummary(data.document.summary || "");
      setSelectedClassification(data.document.classification_ai_suggestion || data.document.classification);
      setSelectedCategory(data.document.category || "lainnya");
      setStage("confirm");

    } catch (err) {
      setStage("error");
      setMessage(err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  };

  const handleConfirm = async () => {
    if (!aiSuggestion) return;
    if (parties.length === 0) {
      alert("Minimal 1 pihak harus diisi.");
      return;
    }

    try {
      setStage("saving"); setMessage("Menyimpan dokumen...");

      const finalCategory = customCategory.trim() || selectedCategory;
      const isClassificationOverride = selectedClassification !== aiSuggestion.classification;
      const isCategoryOverride = finalCategory !== aiSuggestion.category;
      const isSummaryChanged = editedSummary !== aiSuggestion.summary;

      // Update jika ada perubahan
      if (isClassificationOverride || isCategoryOverride || isSummaryChanged) {
        await fetch("/api/documents/update-classification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath,
            classification: selectedClassification,
            category: finalCategory,
            summary: isSummaryChanged ? editedSummary : undefined,
            overrideReason,
          }),
        });
      }

      // Simpan parties
      for (const party of parties) {
        await fetch(`/api/documents/${aiSuggestion.documentId}/parties`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: party.name }),
        });
      }

      setStage("done"); setMessage("Dokumen berhasil diproses!");
      setTimeout(() => {
        setSelectedFile(null); setTitle(""); setStage("idle"); setProgress(0);
        setAiSuggestion(null); setStoragePath(""); setOverrideReason("");
        setSelectedCategory(""); setCustomCategory(""); setEditedSummary("");
        setParties([]); setPartyInput("");
        setDuplicates([]);
        onSuccess?.();
      }, 1500);

    } catch (err) {
      setStage("error");
      setMessage(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  };

  const handleCancel = async () => {
    if (aiSuggestion?.documentId) await cancelAndDelete(aiSuggestion.documentId);
    setSelectedFile(null); setTitle(""); setStage("idle"); setProgress(0); setMessage("");
    setAiSuggestion(null); setStoragePath(""); setOverrideReason("");
    setSelectedCategory(""); setCustomCategory(""); setEditedSummary("");
    setParties([]); setPartyInput(""); setDuplicates([]);
  };

  const isOverride = aiSuggestion && selectedClassification !== aiSuggestion.classification;
  const canConfirm = parties.length > 0;

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Drop zone */}
      {stage === "idle" && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input-clara")?.click()}
            style={{ border: `2px dashed ${isDragging || selectedFile ? "#0344D8" : "#E5E7EB"}`, borderRadius: 12, padding: "24px 20px", textAlign: "center", cursor: "pointer", backgroundColor: isDragging || selectedFile ? "rgba(3,68,216,0.03)" : "#FAFAFA" }}
          >
            <input id="file-input-clara" type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleFileSelect} />
            {selectedFile ? (
              <div>
                <p style={{ fontSize: 24, margin: "0 0 6px" }}>📄</p>
                <p style={{ fontWeight: 600, color: "#1A1F2E", fontSize: 13, margin: "0 0 2px" }}>{selectedFile.name}</p>
                <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 24, margin: "0 0 6px" }}>☁️</p>
                <p style={{ fontWeight: 600, color: "#374151", fontSize: 13, margin: "0 0 4px" }}>Drag & drop PDF di sini</p>
                <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>atau klik untuk memilih · maks. 100MB</p>
              </div>
            )}
          </div>
          {selectedFile && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>Judul Dokumen</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul dokumen..."
                style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              <button onClick={handleUpload}
                style={{ width: "100%", marginTop: 10, backgroundColor: "#0344D8", color: "white", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Upload & Analisis dengan AI
              </button>
            </div>
          )}
        </>
      )}

      {/* Progress */}
      {(stage === "uploading" || stage === "analyzing" || stage === "checking" || stage === "saving") && (
        <div style={{ backgroundColor: "#F8F9FB", borderRadius: 12, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <p style={{ fontSize: 13, color: "#374151", margin: 0, fontWeight: 500 }}>{message}</p>
          </div>
          <div style={{ height: 4, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
            <div style={{ height: 4, backgroundColor: "#0344D8", borderRadius: 4, width: `${progress}%`, transition: "width 0.5s ease" }} />
          </div>
        </div>
      )}

      {/* Confirmation panel */}
      {stage === "confirm" && aiSuggestion && (
        <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ backgroundColor: "#F8F9FB", padding: "14px 16px", borderBottom: "1px solid #EFEFEF" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1F2E", margin: "0 0 2px" }}>✅ Analisis AI selesai — Review sebelum menyimpan</p>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>Semua field dapat diubah · Pihak wajib diisi minimal 1</p>
          </div>

          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Duplikat warning */}
            {duplicates.length > 0 && (
              <div style={{ backgroundColor: "#FFF7ED", border: "2px solid #FED7AA", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#C2410C", margin: "0 0 3px" }}>Kemungkinan Duplikat Terdeteksi</p>
                    <p style={{ fontSize: 12, color: "#7C2D12", margin: 0 }}>Dokumen ini mirip dengan {duplicates.length} dokumen yang sudah ada.</p>
                  </div>
                </div>
                {duplicates.map(dup => (
                  <div key={dup.id} style={{ backgroundColor: "white", border: "1px solid #FED7AA", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1F2E", margin: "0 0 2px" }}>{dup.title}</p>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{dup.classification} · {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(dup.created_at))}</p>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: dup.similarity >= 95 ? "#DC2626" : "#D97706", marginLeft: 12 }}>{dup.similarity}%</span>
                  </div>
                ))}
                <p style={{ fontSize: 11, color: "#7C2D12", margin: "6px 0 0", fontStyle: "italic" }}>Tetap bisa disimpan jika memang berbeda. Atau tekan Batal.</p>
              </div>
            )}

            {/* Scan warning */}
            {aiSuggestion.is_scanned && (
              <div style={{ backgroundColor: "#FEF2F2", border: "2px solid #FECACA", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 10 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>📷</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", margin: "0 0 4px" }}>Dokumen Scan — Klasifikasi Tidak Terdeteksi</p>
                  <p style={{ fontSize: 12, color: "#7F1D1D", margin: 0 }}>AI tidak dapat membaca isi. Default ke <strong>Confidential</strong> — wajib pilih klasifikasi yang tepat.</p>
                </div>
              </div>
            )}

            {/* Summary editable */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Ringkasan Dokumen
                {editedSummary !== aiSuggestion.summary && <span style={{ marginLeft: 8, fontSize: 10, color: "#D97706" }}>⚠️ Diubah dari AI</span>}
              </label>
              <textarea value={editedSummary} onChange={(e) => setEditedSummary(e.target.value)} rows={3}
                placeholder="Ringkasan dokumen..."
                style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 12px", fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6, color: "#374151" }} />
            </div>

            {/* Pihak yang terlibat — WAJIB */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Pihak yang Terlibat <span style={{ color: "#DC2626" }}>*</span>
                <span style={{ marginLeft: 6, fontSize: 10, color: "#9CA3AF", fontWeight: 400, textTransform: "none" }}>wajib minimal 1</span>
              </label>

              {/* Party list */}
              {parties.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {parties.map(party => (
                    <div key={party.name} style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, padding: "4px 10px" }}>
                      <span style={{ fontSize: 12, color: "#0344D8", fontWeight: 500 }}>{party.name}</span>
                      <button onClick={() => removeParty(party.name)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 14, padding: "0 0 0 4px", lineHeight: 1, display: "flex", alignItems: "center" }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Party input with autocomplete */}
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    ref={partyInputRef}
                    type="text"
                    value={partyInput}
                    onChange={(e) => setPartyInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParty(partyInput); } }}
                    onFocus={() => partyInput && setShowSuggestions(true)}
                    placeholder="Ketik nama pihak... (Enter untuk tambah)"
                    style={{ flex: 1, border: `1px solid ${parties.length === 0 ? "#FECACA" : "#E5E7EB"}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", backgroundColor: parties.length === 0 ? "#FFF8F8" : "white" }}
                  />
                  <button onClick={() => addParty(partyInput)} disabled={!partyInput.trim()}
                    style={{ padding: "9px 14px", backgroundColor: partyInput.trim() ? "#0344D8" : "#F3F4F6", color: partyInput.trim() ? "white" : "#9CA3AF", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: partyInput.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", flexShrink: 0 }}>
                    + Tambah
                  </button>
                </div>

                {/* Autocomplete dropdown */}
                {showSuggestions && partySuggestions.length > 0 && (
                  <div ref={suggestionsRef}
                    style={{ position: "absolute", top: "100%", left: 0, right: 52, backgroundColor: "white", border: "1px solid #E5E7EB", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 50, marginTop: 4, overflow: "hidden" }}>
                    {partySuggestions.map(suggestion => (
                      <div key={suggestion.id}
                        onClick={() => addParty(suggestion.name)}
                        style={{ padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F0F5FF"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                      >
                        <span style={{ fontSize: 13, color: "#1A1F2E" }}>{suggestion.name}</span>
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>{suggestion.doc_count} dok</span>
                      </div>
                    ))}
                    {/* Option to add as new if exact match not found */}
                    {!partySuggestions.some(s => s.name.toLowerCase() === partyInput.toLowerCase()) && (
                      <div onClick={() => addParty(partyInput)}
                        style={{ padding: "8px 14px", cursor: "pointer", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 6 }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F0FDF4"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                      >
                        <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>+ Tambah baru:</span>
                        <span style={{ fontSize: 13, color: "#1A1F2E" }}>{partyInput}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {parties.length === 0 && (
                <p style={{ fontSize: 11, color: "#DC2626", margin: "4px 0 0" }}>⚠️ Minimal 1 pihak harus diisi sebelum menyimpan</p>
              )}
            </div>

            {/* Kategori */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Kategori Dokumen
                {(customCategory || selectedCategory !== aiSuggestion.category) && (
                  <span style={{ marginLeft: 8, fontSize: 10, color: "#D97706" }}>⚠️ Diubah dari AI</span>
                )}
              </p>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                {CATEGORY_OPTIONS.map(cat => {
                  const isAI = cat.value === aiSuggestion.category;
                  const isSelected = cat.value === selectedCategory && !customCategory;
                  return (
                    <button key={cat.value}
                      onClick={() => { setSelectedCategory(cat.value); setCustomCategory(""); }}
                      style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: `1px solid ${isSelected ? "#0344D8" : "#E5E7EB"}`, backgroundColor: isSelected ? "#EEF2FF" : "white", color: isSelected ? "#0344D8" : "#6B7280", cursor: "pointer", fontFamily: "inherit" }}>
                      {cat.label}{isAI && <span style={{ marginLeft: 3, fontSize: 9, color: "#16A34A", fontWeight: 700 }}>✦</span>}
                    </button>
                  );
                })}
              </div>
              <input type="text" value={customCategory}
                onChange={(e) => { setCustomCategory(e.target.value); if (e.target.value) setSelectedCategory(""); }}
                placeholder="Atau ketik kategori lain... (Invoice, Proposal, MoM)"
                style={{ width: "100%", border: `1px solid ${customCategory ? "#16A34A" : "#E5E7EB"}`, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box", backgroundColor: customCategory ? "#F0FDF4" : "white" }} />
            </div>

            {/* Klasifikasi */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {aiSuggestion.is_scanned ? "Pilih Klasifikasi" : `Klasifikasi AI (${Math.round(aiSuggestion.classification_confidence * 100)}% yakin)`}
              </p>
              {!aiSuggestion.is_scanned && (
                <div style={{ backgroundColor: CLASSIFICATION_CONFIG[aiSuggestion.classification].bg, border: `1px solid ${CLASSIFICATION_CONFIG[aiSuggestion.classification].border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: CLASSIFICATION_CONFIG[aiSuggestion.classification].color }}>{CLASSIFICATION_CONFIG[aiSuggestion.classification].label}</span>
                  <span style={{ fontSize: 11, color: "#6B7280", marginLeft: 8 }}>— {aiSuggestion.classification_reason}</span>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {(Object.keys(CLASSIFICATION_CONFIG) as DocumentClassification[]).map(cls => {
                  const cfg = CLASSIFICATION_CONFIG[cls];
                  const isSelected = selectedClassification === cls;
                  return (
                    <button key={cls} onClick={() => setSelectedClassification(cls)}
                      style={{ padding: "9px 12px", borderRadius: 10, border: `2px solid ${isSelected ? cfg.color : "#E5E7EB"}`, backgroundColor: isSelected ? cfg.bg : "white", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: cfg.color, margin: "0 0 1px" }}>{cfg.label}</p>
                      <p style={{ fontSize: 10, color: "#9CA3AF", margin: 0 }}>{cfg.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Override reason */}
            {isOverride && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#D97706", display: "block", marginBottom: 4 }}>⚠️ Alasan override klasifikasi (dicatat di audit trail)</label>
                <input type="text" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Alasan mengubah klasifikasi..."
                  style={{ width: "100%", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", backgroundColor: "#FFFBEB" }} />
              </div>
            )}

            {/* Tags */}
            {aiSuggestion.tags?.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tags</p>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {aiSuggestion.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 11, backgroundColor: "#F3F4F6", color: "#6B7280", padding: "3px 8px", borderRadius: 5 }}>{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, paddingTop: 4, borderTop: "1px solid #F3F4F6" }}>
              <button onClick={handleConfirm} disabled={!canConfirm}
                style={{ flex: 1, backgroundColor: canConfirm ? "#0344D8" : "#9CA3AF", color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: canConfirm ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                {!canConfirm ? "⚠️ Isi pihak dulu" : isOverride ? `Simpan sebagai ${CLASSIFICATION_CONFIG[selectedClassification].label}` : "Konfirmasi & Simpan"}
              </button>
              <button onClick={handleCancel}
                style={{ padding: "12px 16px", backgroundColor: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Done */}
      {stage === "done" && (
        <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <p style={{ fontSize: 13, color: "#16A34A", margin: 0, fontWeight: 500 }}>{message}</p>
        </div>
      )}

      {/* Error */}
      {stage === "error" && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>❌</span>
            <p style={{ fontSize: 13, color: "#DC2626", margin: 0, fontWeight: 500 }}>{message}</p>
          </div>
          <button onClick={handleCancel} style={{ fontSize: 12, color: "#0344D8", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Coba lagi →</button>
        </div>
      )}
    </div>
  );
}
