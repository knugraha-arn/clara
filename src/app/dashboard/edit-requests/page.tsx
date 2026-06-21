"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRole } from "@/components/layout/DashboardShell";
import { useToast } from "@/components/ui/Toast";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { formatDateTime } from "@/lib/utils";
import type { DocumentEditRequest } from "@/types";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:  { label: "Menunggu",  color: "#D97706", bg: "#FFFBEB", icon: "⏳" },
  approved: { label: "Disetujui", color: "#16A34A", bg: "#F0FDF4", icon: "✅" },
  rejected: { label: "Ditolak",   color: "#DC2626", bg: "#FEF2F2", icon: "❌" },
};

const FIELD_LABELS: Record<string, string> = {
  title: "Judul Dokumen",
  category: "Kategori",
  summary: "Ringkasan",
  tags: "Tags",
  valid_until: "Berlaku Hingga",
};

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(kosong)";
  if (Array.isArray(value)) return value.join(", ") || "(kosong)";
  return String(value);
}

function ReviewModal({ request, action, onConfirm, onCancel, submitting }: {
  request: DocumentEditRequest;
  action: "approve" | "reject";
  onConfirm: (note: string) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [note, setNote] = useState("");
  const isReject = action === "reject";
  const canConfirm = !submitting && (!isReject || note.trim().length > 0);

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ backgroundColor: "white", borderRadius: 16, padding: 24, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#1A1F2E", margin: "0 0 4px" }}>
          {isReject ? "Tolak Permintaan Perubahan" : "Setujui Permintaan Perubahan"}
        </p>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 16px" }}>
          Diajukan oleh {request.requested_by_name} ({request.requested_by_role})
        </p>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
          placeholder={isReject ? "Alasan penolakan (wajib)" : "Catatan (opsional)"}
          disabled={submitting}
          style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={() => onConfirm(note.trim())} disabled={!canConfirm}
            style={{ flex: 1, backgroundColor: isReject ? "#DC2626" : "#16A34A", color: "white", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: canConfirm ? "pointer" : "not-allowed", opacity: canConfirm ? 1 : 0.5, fontFamily: "inherit" }}>
            {submitting ? "⏳ Memproses..." : isReject ? "Tolak" : "Setujui"}
          </button>
          <button onClick={onCancel} disabled={submitting}
            style={{ padding: "10px 20px", backgroundColor: "#F3F4F6", color: "#374151", border: "none", borderRadius: 10, fontSize: 13, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.5 : 1, fontFamily: "inherit" }}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditRequestsPage() {
  const role = useRole();
  const isAdmin = ["admin", "super_admin"].includes(role);
  const isSuperAdmin = role === "super_admin";
  const { success: toastSuccess, error: toastError } = useToast();

  const [requests, setRequests] = useState<DocumentEditRequest[]>([]);
  const [loading, startLoadingTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [reviewModal, setReviewModal] = useState<{ request: DocumentEditRequest; action: "approve" | "reject" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/documents/edit-requests?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      toastError("Gagal memuat daftar permintaan perubahan.");
    }
  }, [statusFilter, toastError]);

  useEffect(() => {
    startLoadingTransition(async () => {
      await fetchRequests();
    });
  }, [fetchRequests]);

  const canReview = (request: DocumentEditRequest) => {
    if (request.status !== "pending") return false;
    if (request.requested_by_role === "admin") return isSuperAdmin;
    return isAdmin;
  };

  const handleReview = async (note: string) => {
    if (!reviewModal) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/edit-requests/${reviewModal.request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: reviewModal.action, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses");
      toastSuccess(reviewModal.action === "approve" ? "Perubahan disetujui." : "Perubahan ditolak.");
      setReviewModal(null);
      await fetchRequests();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Gagal memproses permintaan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A1F2E", margin: "0 0 4px" }}>Persetujuan Perubahan Dokumen</h1>
        <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>Log immutable — semua keputusan tercatat di Audit Trail</p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["pending", "approved", "rejected", "all"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid", borderColor: statusFilter === s ? "#0344D8" : "#E5E7EB", backgroundColor: statusFilter === s ? "#0344D8" : "white", color: statusFilter === s ? "white" : "#6B7280", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {s === "all" ? "Semua" : STATUS_CFG[s]?.label || s}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonPage rows={5} cols="1fr 140px 120px" />
      ) : requests.length === 0 ? (
        <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "#9CA3AF", margin: 0 }}>Tidak ada permintaan perubahan.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {requests.map(req => {
            const cfg = STATUS_CFG[req.status] || STATUS_CFG.pending;
            return (
              <div key={req.id} style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1F2E", margin: "0 0 3px" }}>
                      {req.requested_by_name} <span style={{ fontWeight: 500, color: "#9CA3AF" }}>({req.requested_by_role})</span>
                    </p>
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{formatDateTime(req.requested_at)}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, backgroundColor: cfg.bg, padding: "3px 9px", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                    {cfg.icon} {cfg.label}{req.auto_approved ? " (auto)" : ""}
                  </span>
                </div>

                <div style={{ backgroundColor: "#F9FAFB", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                  {Object.entries(req.changes).map(([field, { old, new: newVal }]) => (
                    <div key={field} style={{ fontSize: 12, marginBottom: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ color: "#6B7280", fontWeight: 600, minWidth: 100 }}>{FIELD_LABELS[field] || field}:</span>
                      <span style={{ color: "#DC2626", textDecoration: "line-through" }}>{formatChangeValue(old)}</span>
                      <span style={{ color: "#9CA3AF" }}>→</span>
                      <span style={{ color: "#16A34A", fontWeight: 600 }}>{formatChangeValue(newVal)}</span>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: 12, color: "#374151", fontStyle: "italic", margin: "0 0 10px" }}>&quot;{req.reason}&quot;</p>

                {req.status !== "pending" && req.review_note && (
                  <p style={{ fontSize: 11.5, color: "#6B7280", margin: "0 0 10px", padding: "8px 10px", backgroundColor: "#F9FAFB", borderRadius: 6 }}>
                    Catatan {cfg.label.toLowerCase()} oleh {req.reviewed_by_name}: &quot;{req.review_note}&quot;
                  </p>
                )}

                {canReview(req) && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setReviewModal({ request: req, action: "approve" })}
                      style={{ flex: 1, backgroundColor: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      ✅ Setujui
                    </button>
                    <button onClick={() => setReviewModal({ request: req, action: "reject" })}
                      style={{ flex: 1, backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      ❌ Tolak
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {reviewModal && (
        <ReviewModal
          request={reviewModal.request}
          action={reviewModal.action}
          submitting={submitting}
          onConfirm={handleReview}
          onCancel={() => setReviewModal(null)}
        />
      )}
    </>
  );
}
