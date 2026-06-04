"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateStoragePath } from "@/lib/utils";
import type { DocumentClassification } from "@/types";

const CLASSIFICATION_CONFIG: Record<DocumentClassification, { label: string; color: string; bg: string; border: string; desc: string }> = {
  public:       { label: "Public",       color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", desc: "Boleh diketahui publik" },
  internal:     { label: "Internal",     color: "#0344D8", bg: "#EEF2FF", border: "#C7D2FE", desc: "Khusus karyawan" },
  confidential: { label: "Confidential", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", desc: "Terbatas, perlu tahu saja" },
  restricted:   { label: "Restricted",   color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", desc: "Sangat terbatas, board level" },
};

interface DuplicateDoc {
  id: string;
  title: string;
  category: string;
  classification: string;
  created_at: string;
  similarity: number;
}

interface AiSuggestion {
  classification: DocumentClassification;
  classification_confidence: number;
  classification_reason: string;
  category: string;
  summary: string;
  tags: string[];
  is_scanned: boolean;
  documentId: string; // ID dokumen yang baru diupload
}

interface DocumentUploadProps {
  onSuccess?: () => void;
}

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
  const [overrideReason, setOverrideReason] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateDoc[]>([]);

  const supabase = createClient();

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

  // Hapus dokumen yang belum dikonfirmasi
  const cancelAndDelete = async (documentId: string) => {
    try {
      await fetch(`/api/documents?id=${documentId}`, { method: "DELETE" });
    } catch (e) {
      console.error("Failed to delete cancelled doc:", e);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      // 1. Upload ke Supabase Storage
      setStage("uploading");
      setProgress(15);
      setMessage("Mengupload file ke storage...");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");

      const path = generateStoragePath(user.id, selectedFile.name);
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, selectedFile, { contentType: "application/pdf", upsert: false });

      if (uploadError) throw new Error(`Upload gagal: ${uploadError.message}`);
      setStoragePath(path);
      setProgress(40);

      // 2. AI Analysis
      setStage("analyzing");
      setMessage("AI sedang menganalisis dokumen...");
      setProgress(60);

      const res = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: path,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          title: title || selectedFile.name.replace(".pdf", ""),
          classificationOverride: null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Proses gagal");

      const documentId = data.document.id;
      setProgress(80);

      // 3. Cek duplikat — tunggu embedding selesai
      setStage("checking");
      setMessage("Memeriksa duplikat dokumen...");
      await new Promise(r => setTimeout(r, 2000)); // tunggu 2 detik embedding selesai

      let foundDuplicates: DuplicateDoc[] = [];
      try {
        const dupRes = await fetch("/api/documents/check-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        });
        const dupData = await dupRes.json();
        foundDuplicates = dupData.duplicates || [];
      } catch {
        foundDuplicates = [];
      }

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
        documentId, // simpan ID untuk keperluan cancel
      });
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
    const isOverride = selectedClassification !== aiSuggestion.classification;

    try {
      setStage("saving");
      setMessage("Menyimpan klasifikasi...");

      const finalCategory = customCategory.trim() || selectedCategory;
      const isCategoryOverride = finalCategory !== aiSuggestion.category;

      if (isOverride || isCategoryOverride) {
        await fetch("/api/documents/update-classification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath,
            classification: selectedClassification,
            category: finalCategory,
            overrideReason,
          }),
        });
      }

      setStage("done");
      setMessage("Dokumen berhasil diproses!");

      setTimeout(() => {
        setSelectedFile(null);
        setTitle("");
        setStage("idle");
        setProgress(0);
        setAiSuggestion(null);
        setStoragePath("");
        setOverrideReason("");
        setDuplicates([]);
        onSuccess?.();
      }, 1500);

    } catch (err) {
      setStage("error");
      setMessage(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  };

  const handleCancel = async () => {
    // Hapus dokumen dari DB & storage jika sudah diproses
    if (aiSuggestion?.documentId) {
      await cancelAndDelete(aiSuggestion.documentId);
    }
    setSelectedFile(null);
    setTitle("");
    setStage("idle");
    setProgress(0);
    setMessage("");
    setAiSuggestion(null);
    setStoragePath("");
    setOverrideReason("");
    setSelectedCategory("");
    setCustomCategory("");
    setDuplicates([]);
  };

  const isOverride = aiSuggestion && selectedClassification !== aiSuggestion.classification;

  const stageMessages: Partial<Record<Stage, string>> = {
    uploading: message,
    analyzing: message,
    checking: message,
    saving: message,
  };

  const stageProgress: Partial<Record<Stage, number>> = {
    uploading: progress,
    analyzing: progress,
    checking: progress,
    saving: 95,
  };

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
            <p style={{ fontSize: 13, color: "#374151", margin: 0, fontWeight: 500 }}>{stageMessages[stage]}</p>
          </div>
          <div style={{ height: 4, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
            <div style={{ height: 4, backgroundColor: "#0344D8", borderRadius: 4, width: `${stageProgress[stage] || 0}%`, transition: "width 0.5s ease" }} />
          </div>
        </div>
      )}

      {/* Confirmation panel */}
      {stage === "confirm" && aiSuggestion && (
        <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ backgroundColor: "#F8F9FB", padding: "14px 16px", borderBottom: "1px solid #EFEFEF" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1F2E", margin: "0 0 3px" }}>✅ Analisis AI selesai</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>{aiSuggestion.summary}</p>
          </div>

          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

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
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {duplicates.map(dup => (
                    <div key={dup.id} style={{ backgroundColor: "white", border: "1px solid #FED7AA", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1F2E", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dup.title}</p>
                        <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>
                          {dup.classification} · {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(dup.created_at))}
                        </p>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: dup.similarity >= 95 ? "#DC2626" : "#D97706", flexShrink: 0, marginLeft: 12 }}>{dup.similarity}%</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "#7C2D12", margin: "10px 0 0", fontStyle: "italic" }}>
                  Tetap bisa disimpan jika memang berbeda. Atau tekan Batal untuk membatalkan.
                </p>
              </div>
            )}

            {/* Scan warning */}
            {aiSuggestion.is_scanned && (
              <div style={{ backgroundColor: "#FEF2F2", border: "2px solid #FECACA", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>📷</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", margin: "0 0 6px" }}>Dokumen Scan — Klasifikasi Tidak Terdeteksi</p>
                    <p style={{ fontSize: 12, color: "#7F1D1D", margin: "0 0 8px", lineHeight: 1.6 }}>
                      AI tidak dapat membaca isi dokumen. Default ke <strong>Confidential</strong> — wajib review dan pilih klasifikasi yang tepat.
                    </p>
                    <div style={{ backgroundColor: "#FEE2E2", borderRadius: 8, padding: "7px 12px" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#991B1B", margin: 0 }}>
                        ⚠️ Pilih klasifikasi yang sesuai di bawah sebelum menyimpan
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI classification suggestion */}
            {!aiSuggestion.is_scanned && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Klasifikasi AI ({Math.round(aiSuggestion.classification_confidence * 100)}% yakin)
                </p>
                <div style={{ backgroundColor: CLASSIFICATION_CONFIG[aiSuggestion.classification].bg, border: `1px solid ${CLASSIFICATION_CONFIG[aiSuggestion.classification].border}`, borderRadius: 10, padding: "10px 14px" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: CLASSIFICATION_CONFIG[aiSuggestion.classification].color }}>{CLASSIFICATION_CONFIG[aiSuggestion.classification].label}</span>
                  <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 8 }}>— {aiSuggestion.classification_reason}</span>
                </div>
              </div>
            )}

            {/* Category selector */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Kategori Dokumen
                {selectedCategory !== aiSuggestion.category && !customCategory && (
                  <span style={{ marginLeft: 8, fontSize: 10, color: "#D97706", fontWeight: 600 }}>⚠️ Diubah dari AI</span>
                )}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {[
                  { value: "surat_masuk", label: "Surat Masuk" },
                  { value: "surat_keluar", label: "Surat Keluar" },
                  { value: "kontrak", label: "Kontrak" },
                  { value: "memo", label: "Memo" },
                  { value: "laporan", label: "Laporan" },
                  { value: "kebijakan", label: "Kebijakan" },
                  { value: "undangan", label: "Undangan" },
                  { value: "pengumuman", label: "Pengumuman" },
                  { value: "lainnya", label: "Lainnya" },
                ].map(cat => {
                  const isAiSuggested = cat.value === aiSuggestion.category;
                  const isSelected = cat.value === selectedCategory && !customCategory;
                  return (
                    <button key={cat.value}
                      onClick={() => { setSelectedCategory(cat.value); setCustomCategory(""); }}
                      style={{
                        padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                        border: `1px solid ${isSelected ? "#0344D8" : "#E5E7EB"}`,
                        backgroundColor: isSelected ? "#EEF2FF" : "white",
                        color: isSelected ? "#0344D8" : "#6B7280",
                        cursor: "pointer", fontFamily: "inherit",
                        position: "relative",
                      }}>
                      {cat.label}
                      {isAiSuggested && (
                        <span style={{ marginLeft: 4, fontSize: 9, color: "#16A34A", fontWeight: 700 }}>✦ AI</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => { setCustomCategory(e.target.value); if (e.target.value) setSelectedCategory(""); }}
                  placeholder="Atau ketik kategori sendiri... (misal: Invoice, Proposal, MoM)"
                  style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontFamily: "inherit", outline: "none", backgroundColor: customCategory ? "#F0FDF4" : "white", borderColor: customCategory ? "#16A34A" : "#E5E7EB" }}
                />
                {customCategory && (
                  <button onClick={() => setCustomCategory("")}
                    style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #E5E7EB", backgroundColor: "white", cursor: "pointer", fontSize: 12, color: "#9CA3AF", fontFamily: "inherit" }}>
                    ✕
                  </button>
                )}
              </div>
              {customCategory && (
                <p style={{ fontSize: 11, color: "#16A34A", margin: "4px 0 0", fontWeight: 500 }}>
                  ✓ Kategori custom: "{customCategory}"
                </p>
              )}
            </div>

            {/* Classification selector */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {aiSuggestion.is_scanned ? "Pilih klasifikasi" : "Konfirmasi atau ubah"}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {(Object.keys(CLASSIFICATION_CONFIG) as DocumentClassification[]).map((cls) => {
                  const cfg = CLASSIFICATION_CONFIG[cls];
                  const isSelected = selectedClassification === cls;
                  return (
                    <button key={cls} onClick={() => setSelectedClassification(cls)}
                      style={{ padding: "10px 12px", borderRadius: 10, border: `2px solid ${isSelected ? cfg.color : "#E5E7EB"}`, backgroundColor: isSelected ? cfg.bg : "white", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: cfg.color, margin: "0 0 2px" }}>{cfg.label}</p>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{cfg.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Override reason */}
            {isOverride && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#D97706", display: "block", marginBottom: 4 }}>
                  ⚠️ Alasan override (dicatat di audit trail)
                </label>
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

            {/* Scan reminder */}
            {aiSuggestion.is_scanned && selectedClassification === "confidential" && (
              <p style={{ fontSize: 11, color: "#DC2626", textAlign: "center", margin: 0, fontWeight: 500 }}>
                ⚠️ Pastikan Confidential adalah klasifikasi yang tepat
              </p>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleConfirm}
                style={{ flex: 1, backgroundColor: "#0344D8", color: "white", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {isOverride ? `Simpan sebagai ${CLASSIFICATION_CONFIG[selectedClassification].label}` : "Konfirmasi & Simpan"}
              </button>
              <button onClick={handleCancel}
                style={{ padding: "11px 16px", backgroundColor: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
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
          <button onClick={handleCancel} style={{ fontSize: 12, color: "#0344D8", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
            Coba lagi →
          </button>
        </div>
      )}
    </div>
  );
}
