"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import type { UploadProgress } from "@/types";

interface DocumentUploadProps {
  onSuccess?: () => void;
}

export default function DocumentUpload({ onSuccess }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState<UploadProgress | null>(null);

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

    setProgress({ stage: "uploading", progress: 10, message: "Mengupload file..." });

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title || selectedFile.name);

      setProgress({ stage: "extracting", progress: 30, message: "Mengekstrak teks PDF..." });

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      setProgress({ stage: "analyzing", progress: 60, message: "AI sedang menganalisis halaman 1..." });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload gagal");

      setProgress({ stage: "embedding", progress: 85, message: "Membuat vector embedding untuk pencarian..." });

      // Simulasi delay embedding (sudah diproses di server)
      await new Promise((r) => setTimeout(r, 800));

      setProgress({ stage: "done", progress: 100, message: `Dokumen "${data.document.title}" berhasil diproses!` });

      setTimeout(() => {
        setSelectedFile(null);
        setTitle("");
        setProgress(null);
        onSuccess?.();
      }, 2000);

    } catch (err) {
      setProgress({
        stage: "error",
        progress: 0,
        message: err instanceof Error ? err.message : "Terjadi kesalahan",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
          isDragging ? "border-[#0344D8] bg-blue-50" : "border-gray-200 hover:border-[#387EE4] bg-white",
          selectedFile && "border-[#0344D8] bg-blue-50/50"
        )}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileSelect}
        />

        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="w-8 h-8 text-[#0344D8]" />
            <div className="text-left">
              <p className="font-semibold text-[#1A1F2E]">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="font-medium text-gray-700">Drag & drop PDF di sini</p>
            <p className="text-sm text-gray-400">atau klik untuk memilih file (maks. 100MB)</p>
          </div>
        )}
      </div>

      {/* Title Input */}
      {selectedFile && !progress && (
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Judul Dokumen</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul dokumen..."
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0344D8] focus:border-transparent"
          />
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3">
          <div className="flex items-center gap-3">
            {progress.stage === "done" ? (
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            ) : progress.stage === "error" ? (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            ) : (
              <Loader2 className="w-5 h-5 text-[#0344D8] animate-spin shrink-0" />
            )}
            <p className="text-sm font-medium text-gray-700">{progress.message}</p>
          </div>
          {progress.stage !== "error" && (
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-[#0344D8] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && !progress && (
        <button
          onClick={handleUpload}
          className="w-full bg-[#0344D8] hover:bg-[#387EE4] text-white py-3 rounded-xl font-semibold transition-colors"
        >
          Upload & Analisis dengan AI
        </button>
      )}
    </div>
  );
}
