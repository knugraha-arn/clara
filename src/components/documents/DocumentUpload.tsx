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

interface AiSuggestion {
  classification: DocumentClassification;
  classification_confidence: number;
  classification_reason: string;
  category: string;
  summary: string;
  tags: string[];
  is_scanned: boolean;
}

interface DocumentUploadProps {
  onSuccess?: () => void;
}

type Stage = "idle" | "uploading" | "analyzing" | "confirm" | "saving" | "done" | "error";

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
  const [overrideReason, setOverrideReason] = useState("");

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

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      // 1. Upload ke Supabase Storage
      setStage("uploading");
      setProgress(20);
      setMessage("Mengupload file ke storage...");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");

      const path = generateStoragePath(user.id, selectedFile.name);
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, selectedFile, { contentType: "application/pdf", upsert: false });

      if (uploadError) throw new Error(`Upload gagal: ${uploadError.message}`);
      setStoragePath(path);
      setProgress(50);

      // 2. AI Analysis
      setStage("analyzing");
      setMessage("AI sedang menganalisis dokumen dan menentukan klasifikasi...");
      setProgress(70);

      const res = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: path,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          title: title || selectedFile.name.replace(".pdf", ""),
          classificationOverride: null, // belum ada override
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Proses gagal");

      // 3. Tampilkan AI suggestion untuk konfirmasi
      setAiSuggestion({
        classification: data.document.classification_ai_suggestion || data.document.classification,
        classification_confidence: data.document.classification_confidence,
        classification_reason: data.document.classification_reason,
        category: data.document.category,
        summary: data.document.summary,
        tags: data.document.tags,
        is_scanned: data.document.is_scanned || false,
      });
      setSelectedClassification(data.document.classification_ai_suggestion || data.document.classification);
      setProgress(100);
      setStage("confirm");

    } catch (err) {
      setStage("error");
      setMessage(err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  };

  const handleConfirm = async () => {
    if (!aiSuggestion || !storagePath || !selectedFile) return;
    const isOverride = selectedClassification !== aiSuggestion.classification;

    try {
      setStage("saving");
      setMessage("Menyimpan klasifikasi...");

      // Update klasifikasi jika ada override
      if (isOverride) {
        await fetch("/api/documents/update-classification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath,
            classification: selectedClassification,
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
        onSuccess?.();
      }, 1500);

    } catch (err) {
      setStage("error");
      setMessage(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setTitle("");
    setStage("idle");
    setProgress(0);
    setMessage("");
    setAiSuggestion(null);
    setStoragePath("");
    setOverrideReason("");
  };

  const isOverride = aiSuggestion && selectedClassification !== aiSuggestion.classification;

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
            style={{ border: `2px dashed ${isDragging || selectedFile ? "#0344D8" : "#E5E7EB"}`, borderRadius: 12, padding: "24px 20px", textAlign: "center", cursor: "pointer", backgroundColor: isDragging || selectedFile ? "rgba(3,68,216,0.03)" : "#FAFAFA", transition: "all 0.15s" }}
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
      {(stage === "uploading" || stage === "analyzing" || stage === "saving") && (
        <div style={{ backgroundColor: "#F8F9FB", borderRadius: 12, padding: "16px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <p style={{ fontSize: 13, color: "#374151", margin: 0, fontWeight: 500 }}>{message}</p>
          </div>
          <div style={{ height: 4, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
            <div style={{ height: 4, backgroundColor: "#0344D8", borderRadius: 4, width: `${progress}%`, transition: "width 0.5s ease" }} />
          </div>
        </div>
      )}

      {/* AI Suggestion + Override */}
      {stage === "confirm" && aiSuggestion && (
        <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
          {/* AI Result header */}
          <div style={{ backgroundColor: "#F8F9FB", padding: "14px 16px", borderBottom: "1px solid #EFEFEF" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1F2E", margin: "0 0 4px" }}>✅ Analisis AI selesai</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>{aiSuggestion.summary}</p>
          </div>

          <div style={{ padding: "16px" }}>
            {/* Scan warning */}
            {aiSuggestion.is_scanned && (
              <div style={{ marginBottom: 14, backgroundColor: "#FEF2F2", border: "2px solid #FECACA", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>📷</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", margin: "0 0 6px" }}>
                      Dokumen Scan — Klasifikasi Tidak Terdeteksi
                    </p>
                    <p style={{ fontSize: 12, color: "#7F1D1D", margin: "0 0 8px", lineHeight: 1.6 }}>
                      AI tidak dapat membaca isi dokumen ini karena merupakan hasil scan foto. Klasifikasi otomatis <strong>tidak dapat dilakukan</strong> — dokumen ini telah di-set ke <strong>Confidential</strong> sebagai default keamanan.
                    </p>
                    <div style={{ backgroundColor: "#FEE2E2", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#991B1B", margin: 0, lineHeight: 1.5 }}>
                        Anda <u>wajib menentukan klasifikasi yang tepat</u> sebelum menyimpan. Pilih klasifikasi di bawah berdasarkan isi dokumen yang Anda ketahui.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* AI Classification suggestion */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Klasifikasi AI ({Math.round(aiSuggestion.classification_confidence * 100)}% yakin)
              </p>
              <div style={{ backgroundColor: CLASSIFICATION_CONFIG[aiSuggestion.classification].bg, border: `1px solid ${CLASSIFICATION_CONFIG[aiSuggestion.classification].border}`, borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: CLASSIFICATION_CONFIG[aiSuggestion.classification].color }}>
                    {CLASSIFICATION_CONFIG[aiSuggestion.classification].label}
                  </span>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>— {aiSuggestion.classification_reason}</span>
                </div>
              </div>
            </div>

            {/* Override option */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Konfirmasi atau ubah klasifikasi
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {(Object.keys(CLASSIFICATION_CONFIG) as DocumentClassification[]).map((cls) => {
                  const cfg = CLASSIFICATION_CONFIG[cls];
                  const isSelected = selectedClassification === cls;
                  return (
                    <button key={cls} onClick={() => setSelectedClassification(cls)}
                      style={{ padding: "10px 12px", borderRadius: 10, border: `2px solid ${isSelected ? cfg.color : "#E5E7EB"}`, backgroundColor: isSelected ? cfg.bg : "white", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.15s" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: cfg.color, margin: "0 0 2px" }}>{cfg.label}</p>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{cfg.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Override reason */}
            {isOverride && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#D97706", display: "block", marginBottom: 4 }}>
                  ⚠️ Alasan override (akan dicatat di audit trail)
                </label>
                <input type="text" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Contoh: Dokumen bersifat publik, bukan internal..."
                  style={{ width: "100%", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", backgroundColor: "#FFFBEB" }} />
              </div>
            )}

            {/* Tags */}
            {aiSuggestion.tags?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tags</p>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {aiSuggestion.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: 11, backgroundColor: "#F3F4F6", color: "#6B7280", padding: "3px 8px", borderRadius: 5 }}>{tag}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleConfirm}
                style={{ flex: 1, backgroundColor: "#0344D8", color: "white", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {isOverride ? `Simpan sebagai ${CLASSIFICATION_CONFIG[selectedClassification].label}` : "Konfirmasi & Simpan"}
              </button>
              <button onClick={reset}
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
          <button onClick={reset} style={{ fontSize: 12, color: "#0344D8", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
            Coba lagi →
          </button>
        </div>
      )}
    </div>
  );
}
