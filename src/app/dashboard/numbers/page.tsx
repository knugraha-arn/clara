"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRole } from "@/components/layout/DashboardShell";

const ROMAN = ["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
const MONTHS_ID = ["","Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  draft:    { label: "Draft",    color: "#6B7280", bg: "#F3F4F6", icon: "✏️" },
  pending:  { label: "Pending",  color: "#D97706", bg: "#FFFBEB", icon: "⏳" },
  issued:   { label: "Issued",   color: "#0344D8", bg: "#EEF2FF", icon: "✅" },
  linked:   { label: "Linked",   color: "#16A34A", bg: "#F0FDF4", icon: "🔗" },
  rejected: { label: "Rejected", color: "#DC2626", bg: "#FEF2F2", icon: "❌" },
  void:     { label: "Void",     color: "#9CA3AF", bg: "#F9FAFB", icon: "⊘" },
};

const CLS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  public:       { label: "Public",       color: "#16A34A", bg: "#F0FDF4" },
  internal:     { label: "Internal",     color: "#0344D8", bg: "#EEF2FF" },
  confidential: { label: "Confidential", color: "#D97706", bg: "#FFFBEB" },
  restricted:   { label: "Restricted",   color: "#DC2626", bg: "#FEF2F2" },
};

const CAT_LABELS: Record<string, string> = {
  surat_masuk: "Surat Masuk", surat_keluar: "Surat Keluar", kontrak: "Kontrak",
  memo: "Memo", laporan: "Laporan", kebijakan: "Kebijakan",
  undangan: "Undangan", pengumuman: "Pengumuman", lainnya: "Lainnya",
};

interface DocNumber {
  id: string; number: string; sequence: number; year: number; month: number; date: string;
  party_id: string | null; party_name: string; category: string; classification: string;
  description: string; status: string; is_backdated: boolean; document_id: string | null;
  created_by: string; created_by_name: string; reviewed_by_name: string | null;
  review_action: string | null; review_note: string | null; reviewed_at: string | null;
  void_reason: string | null; voided_by_name: string | null; voided_at: string | null;
  created_at: string; updated_at: string;
}

interface Party { id: string; name: string; doc_count: number; }

function formatDate(d: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

function ActionModal({ title, placeholder, onConfirm, onCancel, confirmLabel, confirmColor }:
  { title: string; placeholder: string; onConfirm: (note: string) => void; onCancel: () => void; confirmLabel: string; confirmColor: string }) {
  const [note, setNote] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ backgroundColor: "white", borderRadius: 16, padding: 24, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#1A1F2E", margin: "0 0 12px" }}>{title}</p>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={placeholder} rows={3}
          style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => onConfirm(note)} disabled={!note.trim()}
            style={{ flex: 1, backgroundColor: confirmColor, color: "white", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: note.trim() ? "pointer" : "not-allowed", opacity: note.trim() ? 1 : 0.5, fontFamily: "inherit" }}>
            {confirmLabel}
          </button>
          <button onClick={onCancel}
            style={{ padding: "10px 20px", backgroundColor: "#F3F4F6", color: "#374151", border: "none", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NumbersPage() {
  const role = useRole();
  const canCreate = ["contributor", "admin", "super_admin"].includes(role);
  const isAdmin = ["admin", "super_admin"].includes(role);

  const [numbers, setNumbers] = useState<DocNumber[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [modal, setModal] = useState<{ type: string; id: string; title: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state
  const [formPartyInput, setFormPartyInput] = useState("");
  const [formPartyId, setFormPartyId] = useState<string | null>(null);
  const [formPartySuggestions, setFormPartySuggestions] = useState<Party[]>([]);
  const [showPartySug, setShowPartySug] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formCategory, setFormCategory] = useState("surat_keluar");
  const [formClassification, setFormClassification] = useState("internal");
  const [formDescription, setFormDescription] = useState("");
  const [previewNumber, setPreviewNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const partyInputRef = useRef<HTMLInputElement>(null);

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (yearFilter) params.set("year", yearFilter);
    const res = await fetch(`/api/document-numbers?${params}`);
    const data = await res.json();
    setNumbers(data.numbers || []);
    setPendingCount(data.pendingCount || 0);
    setLoading(false);
  }, [statusFilter, yearFilter]);

  useEffect(() => { fetchNumbers(); }, [fetchNumbers]);

  // Party autocomplete
  useEffect(() => {
    if (formPartyInput.length === 0) { setFormPartySuggestions([]); setShowPartySug(false); return; }
    setShowPartySug(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/parties?q=${encodeURIComponent(formPartyInput)}`);
      const data = await res.json();
      setFormPartySuggestions(data.parties || []);
    }, 150);
    return () => clearTimeout(t);
  }, [formPartyInput]);

  // Preview nomor
  useEffect(() => {
    if (!formPartyInput.trim()) { setPreviewNumber(""); return; }
    const d = new Date(formDate);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    setPreviewNumber(`XXX/${formPartyInput.toUpperCase()}/${ROMAN[month]}/${year}`);
  }, [formPartyInput, formDate]);

  const handleAction = async (id: string, action: string, note?: string) => {
    setActionLoading(id + action);
    await fetch(`/api/document-numbers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    setModal(null);
    await fetchNumbers();
    setActionLoading(null);
  };

  const handleSubmit = async () => {
    if (!formPartyInput.trim() || !formDescription.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/document-numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partyId: formPartyId,
        partyName: formPartyInput.trim().toUpperCase(),
        date: formDate,
        category: formCategory,
        classification: formClassification,
        description: formDescription,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setShowForm(false);
      setFormPartyInput(""); setFormPartyId(null); setFormDescription(""); setPreviewNumber("");
      setFormDate(new Date().toISOString().split("T")[0]);
      await fetchNumbers();
    } else {
      alert(data.error || "Gagal membuat nomor");
    }
    setSubmitting(false);
  };

  const handleExportCSV = () => {
    if (!numbers.length) return;
    const headers = ["Nomor Surat", "Perihal", "Jenis", "Klasifikasi", "Pihak", "Tanggal", "Status", "Dibuat Oleh", "Direview Oleh", "Catatan Review", "Dibuat"];
    const rows = numbers.map(n => [
      n.number,
      `"${(n.description || "").replace(/"/g, '""')}"`,
      CAT_LABELS[n.category] || n.category,
      n.classification,
      n.party_name,
      formatDate(n.date),
      n.status,
      n.created_by_name || "",
      n.reviewed_by_name || "",
      `"${(n.review_note || "").replace(/"/g, '""')}"`,
      formatDate(n.created_at),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CLARA_NomorSurat_${yearFilter}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const today = new Date().toISOString().split("T")[0];
  const isBackdated = formDate < today;
  const pendingNumbers = numbers.filter(n => n.status === "pending");

  // Alert: issued > 30 hari
  const overdueNumbers = numbers.filter(n => {
    if (n.status !== "issued") return false;
    return (Date.now() - new Date(n.created_at).getTime()) / (1000 * 60 * 60 * 24) > 30;
  });

  // Alert: pending > 7 hari
  const stalePendingNumbers = numbers.filter(n => {
    if (n.status !== "pending") return false;
    return (Date.now() - new Date(n.created_at).getTime()) / (1000 * 60 * 60 * 24) > 7;
  });

  const filteredNumbers = numbers;
  const availableYears = [2024, 2025, 2026, 2027].map(y => y.toString());

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {modal && (
        <ActionModal
          title={modal.title}
          placeholder={modal.type === "revision" ? "Catatan revisi untuk contributor..." : modal.type === "reject" ? "Alasan penolakan (wajib)..." : "Alasan void (wajib)..."}
          confirmLabel={modal.type === "revision" ? "Kirim Revisi" : modal.type === "reject" ? "Tolak Nomor" : "Void Nomor"}
          confirmColor={modal.type === "revision" ? "#D97706" : "#DC2626"}
          onConfirm={(note) => handleAction(modal.id, modal.type, note)}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>
            Nomor Surat
            {pendingCount > 0 && isAdmin && (
              <span style={{ marginLeft: 8, fontSize: 11, backgroundColor: "#DC2626", color: "white", padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>{pendingCount}</span>
            )}
          </h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>Sistem penomoran dokumen resmi · {filteredNumbers.length} nomor</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleExportCSV} disabled={!numbers.length}
            style={{ backgroundColor: "#1A1F2E", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: !numbers.length ? 0.5 : 1 }}>
            ⬇️ CSV
          </button>
          {canCreate && (
            <button onClick={() => setShowForm(!showForm)}
              style={{ backgroundColor: showForm ? "#F3F4F6" : "#0344D8", color: showForm ? "#374151" : "white", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {showForm ? "✕ Tutup" : "+ Buat Nomor Surat"}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "20px 28px" }}>

        {/* Alerts */}
        {stalePendingNumbers.length > 0 && isAdmin && (
          <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 10, display: "flex", gap: 8 }}>
            <span>🔴</span>
            <p style={{ fontSize: 13, color: "#DC2626", margin: 0, fontWeight: 500 }}>
              {stalePendingNumbers.length} nomor backdated sudah menunggu approval lebih dari 7 hari — segera ditindaklanjuti.
            </p>
          </div>
        )}
        {overdueNumbers.length > 0 && (
          <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 8 }}>
            <span>⚠️</span>
            <p style={{ fontSize: 13, color: "#DC2626", margin: 0, fontWeight: 500 }}>
              {overdueNumbers.length} nomor surat sudah Issued lebih dari 30 hari tanpa dokumen terlampir.
            </p>
          </div>
        )}

        {/* Form */}
        {showForm && canCreate && (
          <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#1A1F2E", margin: "0 0 16px" }}>Buat Nomor Surat Baru</p>

            {previewNumber && (
              <div style={{ backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, padding: "10px 16px", marginBottom: 16, textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "#6B7280", margin: "0 0 2px" }}>Preview Nomor Surat</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#0344D8", margin: 0, letterSpacing: "0.5px" }}>{previewNumber}</p>
                {isBackdated && (
                  <p style={{ fontSize: 11, color: "#D97706", margin: "4px 0 0", fontWeight: 600 }}>
                    ⚠️ Backdated · {role === "contributor" ? "Memerlukan approval Admin" : "Langsung Issued"}
                  </p>
                )}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>Tanggal Surat</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                  style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>Jenis Dokumen</label>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
                  style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}>
                  {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div style={{ position: "relative" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>Pihak <span style={{ color: "#DC2626" }}>*</span></label>
                <input ref={partyInputRef} type="text" value={formPartyInput}
                  onChange={e => { setFormPartyInput(e.target.value); setFormPartyId(null); if (e.target.value.length > 0) setShowPartySug(true); }}
                  onFocus={() => { if (formPartyInput.length > 0) setShowPartySug(true); }}
                  placeholder="Ketik nama pihak..."
                  style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                {showPartySug && formPartySuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "white", border: "1px solid #E5E7EB", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 50, marginTop: 2 }}>
                    {formPartySuggestions.map(s => (
                      <div key={s.id} onClick={() => { setFormPartyInput(s.name); setFormPartyId(s.id); setShowPartySug(false); }}
                        style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between" }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "#F0F5FF"}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}>
                        <span>{s.name}</span>
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>{s.doc_count} dok</span>
                      </div>
                    ))}
                    {!formPartySuggestions.some(s => s.name.toLowerCase() === formPartyInput.toLowerCase()) && (
                      <div onClick={() => setShowPartySug(false)}
                        style={{ padding: "8px 12px", cursor: "pointer", fontSize: 12, color: "#16A34A", fontWeight: 600, borderTop: "1px solid #F3F4F6" }}>
                        + Gunakan "{formPartyInput.toUpperCase()}" sebagai pihak baru
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>Klasifikasi</label>
                <select value={formClassification} onChange={e => setFormClassification(e.target.value)}
                  style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}>
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>Perihal / Uraian <span style={{ color: "#DC2626" }}>*</span></label>
              <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2}
                placeholder="Uraian singkat isi surat..."
                style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={handleSubmit} disabled={!formPartyInput.trim() || !formDescription.trim() || submitting}
                style={{ flex: 1, backgroundColor: "#0344D8", color: "white", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: !formPartyInput.trim() || !formDescription.trim() || submitting ? 0.5 : 1 }}>
                {submitting ? "Membuat..." : isBackdated && role === "contributor" ? "Ajukan (Perlu Approval)" : "Buat Nomor Surat"}
              </button>
              <button onClick={() => { setShowForm(false); setFormPartyInput(""); setFormDescription(""); setPreviewNumber(""); }}
                style={{ padding: "11px 16px", backgroundColor: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Pending approval */}
        {isAdmin && pendingNumbers.length > 0 && (
          <div style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#D97706", margin: "0 0 14px" }}>⏳ Menunggu Approval ({pendingNumbers.length})</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pendingNumbers.map(num => {
                const daysPending = Math.floor((Date.now() - new Date(num.created_at).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={num.id} style={{ backgroundColor: "white", border: `1px solid ${daysPending > 7 ? "#FECACA" : "#FDE68A"}`, borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#1A1F2E" }}>{num.number}</span>
                          <span style={{ fontSize: 10, backgroundColor: "#FEF2F2", color: "#DC2626", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Backdated</span>
                          {daysPending > 7 && <span style={{ fontSize: 10, backgroundColor: "#FEF2F2", color: "#DC2626", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>⚠️ {daysPending} hari</span>}
                        </div>
                        <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 2px" }}>{num.description}</p>
                        <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{CAT_LABELS[num.category]} · {formatDate(num.date)} · oleh: {num.created_by_name}</p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => handleAction(num.id, "approve")} disabled={!!actionLoading}
                          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", color: "#16A34A", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          ✅ Approve
                        </button>
                        <button onClick={() => setModal({ type: "revision", id: num.id, title: "Minta Revisi" })}
                          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #FDE68A", backgroundColor: "#FFFBEB", color: "#D97706", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          ✏️ Revisi
                        </button>
                        <button onClick={() => setModal({ type: "reject", id: num.id, title: "Tolak Nomor Surat" })}
                          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #FECACA", backgroundColor: "#FEF2F2", color: "#DC2626", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          ❌ Tolak
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { value: "all", label: "Semua" },
              { value: "draft", label: "✏️ Draft" },
              { value: "pending", label: "⏳ Pending" },
              { value: "issued", label: "✅ Issued" },
              { value: "linked", label: "🔗 Linked" },
              { value: "rejected", label: "❌ Rejected" },
              { value: "void", label: "⊘ Void" },
            ].map(f => (
              <button key={f.value} onClick={() => setStatusFilter(f.value)}
                style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer", fontFamily: "inherit", backgroundColor: statusFilter === f.value ? "#1A1F2E" : "white", color: statusFilter === f.value ? "white" : "#6B7280", borderColor: statusFilter === f.value ? "#1A1F2E" : "#E5E7EB" }}>
                {f.label}
              </button>
            ))}
          </div>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontFamily: "inherit", outline: "none", color: "#374151" }}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* List */}
        <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "190px 1fr 110px 110px 90px 100px 140px", gap: 10, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA" }}>
            {["Nomor Surat", "Perihal", "Jenis", "Klasifikasi", "Tanggal", "Status", "Aksi"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF" }}>Memuat...</div>
          ) : filteredNumbers.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <p style={{ fontSize: 32, margin: "0 0 8px" }}>📝</p>
              <p style={{ color: "#6B7280", fontWeight: 600, margin: 0 }}>Belum ada nomor surat</p>
              {canCreate && <button onClick={() => setShowForm(true)} style={{ marginTop: 10, color: "#0344D8", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit" }}>Buat sekarang →</button>}
            </div>
          ) : (
            filteredNumbers.map((num, i) => {
              const stsCfg = STATUS_CFG[num.status] || STATUS_CFG.draft;
              const clsCfg = CLS_CFG[num.classification] || CLS_CFG.internal;
              const isOverdue = num.status === "issued" && (Date.now() - new Date(num.created_at).getTime()) / (1000 * 60 * 60 * 24) > 30;

              return (
                <div key={num.id}
                  style={{ display: "grid", gridTemplateColumns: "190px 1fr 110px 110px 90px 100px 140px", gap: 10, padding: "12px 16px", borderBottom: i < filteredNumbers.length - 1 ? "1px solid #F5F5F5" : "none", alignItems: "flex-start", backgroundColor: isOverdue ? "#FFF8F8" : "white" }}
                  onMouseEnter={e => { if (!isOverdue) e.currentTarget.style.backgroundColor = "#FAFBFF"; }}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = isOverdue ? "#FFF8F8" : "white"}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#1A1F2E", margin: "0 0 2px", letterSpacing: "0.3px" }}>{num.number}</p>
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{num.created_by_name}</p>
                    {num.is_backdated && <span style={{ fontSize: 10, backgroundColor: "#FFFBEB", color: "#D97706", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>Backdated</span>}
                    {num.review_note && ["draft", "rejected"].includes(num.status) && (
                      <p style={{ fontSize: 10, color: "#DC2626", margin: "3px 0 0", fontStyle: "italic" }}>💬 {num.review_note}</p>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "#374151", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{num.description}</p>
                    {num.document_id && <p style={{ fontSize: 10, color: "#16A34A", margin: "2px 0 0" }}>🔗 Dokumen terlampir</p>}
                  </div>
                  <span style={{ fontSize: 11, color: "#6B7280" }}>{CAT_LABELS[num.category] || num.category}</span>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: clsCfg.bg, color: clsCfg.color, padding: "2px 7px", borderRadius: 4 }}>{clsCfg.label}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#6B7280" }}>{formatDate(num.date)}</span>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, backgroundColor: stsCfg.bg, color: stsCfg.color, padding: "3px 8px", borderRadius: 6 }}>
                      {stsCfg.icon} {stsCfg.label}
                    </span>
                    {isOverdue && <p style={{ fontSize: 10, color: "#DC2626", margin: "3px 0 0" }}>⚠️ &gt;30 hari</p>}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {num.status === "draft" && (
                      <button onClick={() => handleAction(num.id, "resubmit")}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #C7D2FE", backgroundColor: "#EEF2FF", color: "#0344D8", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        Resubmit
                      </button>
                    )}
                    {num.status === "issued" && (
                      <a href="/dashboard" style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", color: "#16A34A", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "none" }}>
                        ⬆️ Upload
                      </a>
                    )}
                    {isAdmin && ["issued", "linked"].includes(num.status) && (
                      <button onClick={() => setModal({ type: "void", id: num.id, title: "Void Nomor Surat" })}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #E5E7EB", backgroundColor: "white", color: "#9CA3AF", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        ⊘ Void
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
