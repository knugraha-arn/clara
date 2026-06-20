"use client";

import { useState, useEffect } from "react";
import { useRole } from "@/components/layout/DashboardShell";
import Image from "next/image";
import { formatDateShort, formatSize } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { SkeletonPage, SkeletonListRow } from "@/components/ui/Skeleton";
import type { Document } from "@/types";

function formatDate(d: string | null) {
  if (!d) return "Belum pernah";
  return formatDateShort(d);
}

const ROLE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  viewer:      { label: "Viewer",      color: "#9CA3AF", bg: "#F9FAFB" },
  auditor:     { label: "Auditor",     color: "#6B7280", bg: "#F3F4F6" },
  contributor: { label: "Contributor", color: "#0344D8", bg: "#EEF2FF" },
  admin:       { label: "Admin",       color: "#D97706", bg: "#FFFBEB" },
  super_admin: { label: "Super Admin", color: "#DC2626", bg: "#FEF2F2" },
};

interface UserData {
  id: string; email: string; full_name: string; avatar_url: string | null;
  role: string; is_suspended: boolean; suspended_at: string | null;
  created_at: string; last_sign_in_at: string | null;
  upload_count: number; download_count: number;
}

interface DocWithUploader extends Document { uploader_name?: string; }

export default function ConfigPage() {
  const role = useRole();
  const canAccess = role === "super_admin";
  const [activeTab, setActiveTab] = useState<"users" | "documents">("users");

  const { success: toastSuccess, error: toastError } = useToast();

  // Users state
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Documents state
  const [documents, setDocuments] = useState<DocWithUploader[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteReason, setDeleteReason] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [docSearch, setDocSearch] = useState("");

  useEffect(() => {
    if (!canAccess) return;
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => { if (user) setCurrentUserId(user.id); });
    });
    fetch("/api/users")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setUsers(d.users || []); setUsersLoading(false); })
      .catch(() => { toastError("Gagal memuat data pengguna."); setUsersLoading(false); });
    fetch("/api/documents?limit=200")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setDocuments(d.documents || []); setDocsLoading(false); })
      .catch(() => { toastError("Gagal memuat daftar dokumen."); setDocsLoading(false); });
  }, [canAccess, toastError]);

  const handleUserAction = async (userId: string, action: string, newRole?: string) => {
    setSaving(userId);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, role: newRole }),
      });
      if (!res.ok) throw new Error();
      const actionLabels: Record<string, string> = {
        suspend: "disuspend", unsuspend: "diaktifkan kembali", change_role: "diperbarui",
      };
      toastSuccess(`Pengguna berhasil ${actionLabels[action] || action}.`);
      const refreshed = await fetch("/api/users");
      const data = await refreshed.json();
      setUsers(data.users || []);
    } catch {
      toastError("Gagal memproses aksi pengguna.");
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0 || !deleteReason.trim()) return;
    setDeleting(true);
    try {
      const ids = [...selected];
      const results = await Promise.all(
        ids.map(id => fetch(`/api/documents?id=${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: deleteReason.trim() }),
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
      const res = await fetch("/api/documents?limit=200");
      const data = await res.json();
      setDocuments(data.documents || []);
      setDeleting(false);
    }
  };

  const filteredDocs = documents.filter(d => {
    if (!docSearch.trim()) return true;
    const q = docSearch.toLowerCase();
    return d.title?.toLowerCase().includes(q) || d.file_name?.toLowerCase().includes(q) || d.uploader_name?.toLowerCase().includes(q);
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
      {/* Confirm modal */}
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "white", borderRadius: 16, padding: 24, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#1A1F2E", margin: "0 0 8px" }}>⚠️ Konfirmasi Hapus</p>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px" }}>Hapus <strong>{selected.size} dokumen</strong> secara permanen?</p>
            <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={3}
              placeholder="Alasan penghapusan (wajib)..."
              style={{ width: "100%", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box", backgroundColor: "#FEF2F2" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
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

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Konfigurasi</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>User management & kelola dokumen</p>
        </div>
        <Image src="/arranet-logo-black.png" alt="Arranetwork" width={90} height={22} style={{ opacity: 0.35 }} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #EFEFEF", backgroundColor: "white", padding: "0 28px" }}>
        {[
          { key: "users", label: "👥 User Management" },
          { key: "documents", label: "🗑️ Kelola Dokumen" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as "users" | "documents")}
            style={{ padding: "11px 20px", border: "none", borderBottom: `2px solid ${activeTab === tab.key ? "#0344D8" : "transparent"}`, backgroundColor: "transparent", color: activeTab === tab.key ? "#0344D8" : "#6B7280", fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 28px" }}>

        {/* ===================== USERS TAB ===================== */}
        {activeTab === "users" && (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Total", value: users.length, color: "#0344D8" },
                { label: "Viewer", value: users.filter(u => u.role === "viewer").length, color: "#9CA3AF" },
                { label: "Aktif", value: users.filter(u => !u.is_suspended).length, color: "#16A34A" },
                { label: "Suspended", value: users.filter(u => u.is_suspended).length, color: "#DC2626" },
                { label: "Admin+", value: users.filter(u => ["admin", "super_admin"].includes(u.role)).length, color: "#D97706" },
              ].map(s => (
                <div key={s.label} style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 3px" }}>{s.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 70px 70px 110px 160px", gap: 10, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA" }}>
                {["User", "Role", "Upload", "Download", "Last Active", "Aksi"].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                ))}
              </div>

              {usersLoading ? (
                <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonListRow key={i} />)}
                </div>
              ) : (
                users.map((u, i) => {
                  const roleCfg = ROLE_CFG[u.role] || ROLE_CFG.viewer;
                  const isSaving = saving === u.id;
                  const isSelf = u.id === currentUserId;
                  const initials = (u.full_name || u.email || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

                  return (
                    <div key={u.id}
                      style={{ display: "grid", gridTemplateColumns: "1fr 140px 70px 70px 110px 160px", gap: 10, padding: "11px 16px", borderBottom: i < users.length - 1 ? "1px solid #F5F5F5" : "none", alignItems: "center", opacity: u.is_suspended ? 0.6 : 1 }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "#FAFBFF"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        {u.avatar_url ? (
                          <Image src={u.avatar_url} alt={u.full_name} width={30} height={30} style={{ borderRadius: "50%", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "#0344D8", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1F2E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {u.full_name || "—"}
                            {u.is_suspended && <span style={{ marginLeft: 6, fontSize: 9, backgroundColor: "#FEF2F2", color: "#DC2626", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>SUSPENDED</span>}
                            {isSelf && <span style={{ marginLeft: 6, fontSize: 9, backgroundColor: "#EEF2FF", color: "#0344D8", padding: "1px 4px", borderRadius: 3 }}>Anda</span>}
                          </p>
                          <p style={{ fontSize: 10, color: "#9CA3AF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</p>
                        </div>
                      </div>

                      <select value={u.role} disabled={isSaving || u.is_suspended || isSelf}
                        onChange={e => handleUserAction(u.id, "change_role", e.target.value)}
                        style={{ fontSize: 11, fontWeight: 600, backgroundColor: roleCfg.bg, color: roleCfg.color, border: `1px solid ${roleCfg.color}30`, borderRadius: 6, padding: "4px 6px", cursor: isSelf ? "not-allowed" : "pointer", fontFamily: "inherit", width: "100%", opacity: isSaving ? 0.5 : 1 }}>
                        <option value="viewer">Viewer</option>
                        <option value="auditor">Auditor</option>
                        <option value="contributor">Contributor</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>

                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0344D8", textAlign: "center" }}>{u.upload_count}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#16A34A", textAlign: "center" }}>{u.download_count}</span>
                      <span style={{ fontSize: 11, color: "#6B7280" }}>{formatDate(u.last_sign_in_at)}</span>

                      <div style={{ display: "flex", gap: 5 }}>
                        {isSelf ? (
                          <span style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic" }}>Akun Anda</span>
                        ) : u.is_suspended ? (
                          <button onClick={() => handleUserAction(u.id, "unsuspend")} disabled={isSaving}
                            style={{ flex: 1, padding: "5px 8px", borderRadius: 7, border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", color: "#16A34A", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            {isSaving ? "..." : "✓ Aktifkan"}
                          </button>
                        ) : (
                          <button onClick={() => { if (!confirm(`Suspend ${u.full_name || u.email}?`)) return; handleUserAction(u.id, "suspend"); }} disabled={isSaving}
                            style={{ flex: 1, padding: "5px 8px", borderRadius: 7, border: "1px solid #FECACA", backgroundColor: "#FEF2F2", color: "#DC2626", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            {isSaving ? "..." : "⊘ Suspend"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ===================== DOCUMENTS TAB ===================== */}
        {activeTab === "documents" && (
          <>
            <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 8 }}>
              <span>⚠️</span>
              <p style={{ fontSize: 12, color: "#7F1D1D", margin: 0 }}>Penghapusan permanen dan tidak bisa dikembalikan. Gunakan hanya untuk duplikat atau dokumen error.</p>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14 }}>🔍</span>
                <input type="text" value={docSearch} onChange={e => setDocSearch(e.target.value)}
                  placeholder="Cari dokumen, nama file, uploader..."
                  style={{ width: "100%", paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9, border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
              {selected.size > 0 && (
                <button onClick={() => setShowConfirm(true)}
                  style={{ backgroundColor: "#DC2626", color: "white", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  🗑️ Hapus {selected.size} Dokumen
                </button>
              )}
            </div>

            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 110px 110px 120px 80px", gap: 10, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA", alignItems: "center" }}>
                <input type="checkbox"
                  checked={filteredDocs.length > 0 && selected.size === filteredDocs.length}
                  onChange={() => selected.size === filteredDocs.length ? setSelected(new Set()) : setSelected(new Set(filteredDocs.map(d => d.id)))}
                  style={{ width: 15, height: 15, cursor: "pointer" }} />
                {["Dokumen", "Klasifikasi", "Kategori", "Uploader", "Ukuran"].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                ))}
              </div>

              {docsLoading ? (
                <SkeletonPage rows={5} cols="40px 1fr 110px 110px 120px 90px 70px" />
              ) : filteredDocs.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF" }}>Tidak ada dokumen</div>
              ) : (
                filteredDocs.map((doc, i) => {
                  const isSelected = selected.has(doc.id);
                  return (
                    <div key={doc.id} onClick={() => { const s = new Set(selected); if (isSelected) { s.delete(doc.id); } else { s.add(doc.id); } setSelected(s); }}
                      style={{ display: "grid", gridTemplateColumns: "40px 1fr 110px 110px 120px 80px", gap: 10, padding: "10px 16px", borderBottom: i < filteredDocs.length - 1 ? "1px solid #F5F5F5" : "none", backgroundColor: isSelected ? "#FEF2F2" : "white", cursor: "pointer", alignItems: "center" }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "#FAFBFF"; }}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = isSelected ? "#FEF2F2" : "white"}>
                      <input type="checkbox" checked={isSelected} onChange={() => {}} onClick={e => e.stopPropagation()} style={{ width: 15, height: 15, cursor: "pointer" }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1F2E", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</p>
                        <p style={{ fontSize: 10, color: "#9CA3AF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name}</p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, backgroundColor: "#EEF2FF", color: "#0344D8", padding: "2px 6px", borderRadius: 4 }}>{doc.classification}</span>
                      <span style={{ fontSize: 11, color: "#6B7280" }}>{doc.category}</span>
                      <span style={{ fontSize: 11, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.uploader_name || "—"}</span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{formatSize(doc.file_size)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
