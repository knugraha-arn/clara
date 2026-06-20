"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRole } from "@/components/layout/DashboardShell";
import { CATEGORY_LABELS, CLS_CFG, formatDateShort, formatSize } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { SkeletonPage } from "@/components/ui/Skeleton";
import type { Document, DocumentCategory } from "@/types";

const formatDate = formatDateShort;

interface DocWithUploader extends Document { uploader_name?: string; }

export default function AdminPage() {
  const role = useRole();
  const canAccess = role === "super_admin";

  const { success: toastSuccess, error: toastError } = useToast();
  const [documents, setDocuments] = useState<DocWithUploader[]>([]);
  const [loading, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents?limit=200");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      toastError("Gagal memuat daftar dokumen.");
    }
  }, [toastError]);

  const refetchDocuments = useCallback(() => {
    startTransition(async () => {
      await fetchDocuments();
    });
  }, [fetchDocuments]);

  useEffect(() => {
    if (!canAccess) return;
    startTransition(async () => {
      await fetchDocuments();
    });
  }, [canAccess, fetchDocuments]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(d => d.id)));
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0 || !deleteReason.trim()) return;
    setDeleting(true);
    try {
      const ids = [...selected];
      const results = await Promise.all(
        ids.map(id => fetch(`/api/documents?id=${id}&reason=${encodeURIComponent(deleteReason.trim())}`, {
          method: "DELETE",
        }))
      );
      const failedCount = results.filter(r => !r.ok).length;
      if (failedCount === 0) {
        toastSuccess(`${ids.length} dokumen berhasil dihapus.`);
      } else if (failedCount < ids.length) {
        toastError(`${ids.length - failedCount} dokumen terhapus, ${failedCount} gagal dihapus.`);
      } else {
        toastError("Gagal menghapus dokumen.");
      }
    } catch {
      toastError("Gagal menghapus sebagian dokumen.");
    } finally {
      setSelected(new Set());
      setDeleteReason("");
      setShowConfirm(false);
      refetchDocuments();
      setDeleting(false);
    }
  };

  const filtered = documents.filter(d => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return d.title?.toLowerCase().includes(q) ||
      d.file_name?.toLowerCase().includes(q) ||
      d.uploader_name?.toLowerCase().includes(q);
  });

  if (!canAccess) {
    return (
      <div style={{ padding: "40px 28px", textAlign: "center", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔒</p>
        <p style={{ fontWeight: 600, color: "#6B7280" }}>Akses ditolak — khusus Super Admin</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Admin — Kelola Dokumen</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>
            {selected.size > 0 ? `${selected.size} dokumen dipilih` : `${filtered.length} dokumen`}
          </p>
        </div>
        {selected.size > 0 && (
          <button onClick={() => setShowConfirm(true)}
            style={{ backgroundColor: "#DC2626", color: "white", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            🗑️ Hapus {selected.size} Dokumen
          </button>
        )}
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "white", borderRadius: 16, padding: 24, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#1A1F2E", margin: "0 0 8px" }}>⚠️ Konfirmasi Hapus</p>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px", lineHeight: 1.5 }}>
              Anda akan menghapus <strong>{selected.size} dokumen</strong> secara permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#DC2626", display: "block", marginBottom: 6 }}>
                Alasan penghapusan (wajib diisi — dicatat di audit trail)
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Contoh: Duplikat dokumen, file rusak, upload tidak sengaja..."
                rows={3}
                style={{ width: "100%", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box", backgroundColor: "#FEF2F2" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDelete} disabled={!deleteReason.trim() || deleting}
                style={{ flex: 1, backgroundColor: "#DC2626", color: "white", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: !deleteReason.trim() || deleting ? 0.5 : 1 }}>
                {deleting ? "Menghapus..." : `Hapus ${selected.size} Dokumen`}
              </button>
              <button onClick={() => { setShowConfirm(false); setDeleteReason(""); }}
                style={{ padding: "11px 20px", backgroundColor: "#F3F4F6", color: "#374151", border: "none", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "20px 28px" }}>
        {/* Warning */}
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <p style={{ fontSize: 12, color: "#7F1D1D", margin: 0, lineHeight: 1.5 }}>
            Halaman ini untuk keperluan admin sementara. Penghapusan permanen dan tidak bisa dikembalikan.
            Deletion flow yang proper (dengan approval) akan diimplementasi di release berikutnya.
          </p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari dokumen, nama file, uploader..."
            style={{ width: "100%", paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9, border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* Table */}
        <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 110px 110px 120px 90px 70px", gap: 10, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA", alignItems: "center" }}>
            <input type="checkbox"
              checked={filtered.length > 0 && selected.size === filtered.length}
              onChange={toggleAll}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            {["Dokumen", "Klasifikasi", "Kategori", "Diupload Oleh", "Tgl Upload", "Ukuran"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <SkeletonPage rows={6} cols="40px 1fr 110px 110px 120px 90px 70px" />
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF" }}>Tidak ada dokumen</div>
          ) : (
            filtered.map((doc, i) => {
              const isSelected = selected.has(doc.id);
              const clsCfg = CLS_CFG[doc.classification] || CLS_CFG.internal;
              return (
                <div key={doc.id}
                  style={{ display: "grid", gridTemplateColumns: "40px 1fr 110px 110px 120px 90px 70px", gap: 10, padding: "11px 16px", borderBottom: i < filtered.length - 1 ? "1px solid #F5F5F5" : "none", backgroundColor: isSelected ? "#FEF2F2" : "white", alignItems: "center", cursor: "pointer", transition: "background 0.1s" }}
                  onClick={() => toggleSelect(doc.id)}
                >
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(doc.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 16, height: 16, cursor: "pointer" }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1F2E", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.title}
                      {doc.is_scanned && <span style={{ marginLeft: 6, fontSize: 10, backgroundColor: "#FFFBEB", color: "#D97706", padding: "1px 5px", borderRadius: 4 }}>📷 Scan</span>}
                    </p>
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: clsCfg.bg, color: clsCfg.color, padding: "2px 7px", borderRadius: 4 }}>
                      {doc.classification}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>{CATEGORY_LABELS[doc.category as DocumentCategory] || doc.category}</span>
                  <span style={{ fontSize: 11, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.uploader_name || "—"}</span>
                  <span style={{ fontSize: 11, color: "#6B7280" }}>{formatDate(doc.created_at)}</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{formatSize(doc.file_size)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
