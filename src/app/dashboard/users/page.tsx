"use client";

import { useState, useEffect } from "react";
import { useRole } from "@/components/layout/DashboardShell";
import Image from "next/image";
import { formatDateShort } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { SkeletonListRow } from "@/components/ui/Skeleton";

// formatDate di sini perlu handle null + teks berbeda, jadi buat wrapper tipis
function formatDate(d: string | null) {
  if (!d) return "Belum pernah";
  return formatDateShort(d);
}

const ROLE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  auditor:     { label: "Auditor",     color: "#6B7280", bg: "#F3F4F6" },
  contributor: { label: "Contributor", color: "#0344D8", bg: "#EEF2FF" },
  admin:       { label: "Admin",       color: "#D97706", bg: "#FFFBEB" },
  super_admin: { label: "Super Admin", color: "#DC2626", bg: "#FEF2F2" },
};

interface UserData {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  is_suspended: boolean;
  suspended_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  upload_count: number;
  download_count: number;
}

export default function UsersPage() {
  const role = useRole();
  const canView = role === "super_admin";

  const { success: toastSuccess, error: toastError } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) return;
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setCurrentUserId(user.id);
      });
    });
    fetch("/api/users")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setUsers(d.users || []); setLoading(false); })
      .catch(() => { toastError("Gagal memuat data pengguna."); setLoading(false); });
  }, [canView, toastError]);

  const handleAction = async (userId: string, action: string, newRole?: string) => {
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

  if (!canView) {
    return (
      <div style={{ padding: "40px 28px", textAlign: "center", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔒</p>
        <p style={{ fontWeight: 600, color: "#6B7280" }}>Akses ditolak — khusus Super Admin</p>
      </div>
    );
  }

  const today = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>User Management</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>{users.length} user terdaftar</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, color: "#9CA3AF" }}>{today}</span>
          <Image src="/arranet-logo-black.png" alt="Arranetwork" width={90} height={22} style={{ opacity: 0.35 }} />
        </div>
      </div>

      <div style={{ padding: "20px 28px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total User", value: users.length, color: "#0344D8" },
            { label: "Aktif", value: users.filter(u => !u.is_suspended).length, color: "#16A34A" },
            { label: "Suspended", value: users.filter(u => u.is_suspended).length, color: "#DC2626" },
            { label: "Admin+", value: users.filter(u => ["admin", "super_admin"].includes(u.role)).length, color: "#D97706" },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 4px" }}>{s.label}</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* User table */}
        <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 80px 120px 180px", gap: 12, padding: "10px 16px", borderBottom: "1px solid #F5F5F5", backgroundColor: "#FAFAFA" }}>
            {["User", "Role", "Upload", "Download", "Last Active", "Aksi"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonListRow key={i} />)}
            </div>
          ) : (
            users.map((u, i) => {
              const roleCfg = ROLE_CFG[u.role] || ROLE_CFG.auditor;
              const isSaving = saving === u.id;
              const initials = (u.full_name || u.email || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

              return (
                <div key={u.id}
                  style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 80px 120px 180px", gap: 12, padding: "12px 16px", borderBottom: i < users.length - 1 ? "1px solid #F5F5F5" : "none", alignItems: "center", opacity: u.is_suspended ? 0.6 : 1 }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#FAFBFF"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
                >
                  {/* User info */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    {u.avatar_url ? (
                      <Image src={u.avatar_url} alt={u.full_name} width={32} height={32} style={{ borderRadius: "50%", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#0344D8", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {initials}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1F2E", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.full_name || "—"}
                        {u.is_suspended && <span style={{ marginLeft: 6, fontSize: 10, backgroundColor: "#FEF2F2", color: "#DC2626", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>SUSPENDED</span>}
                      </p>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</p>
                    </div>
                  </div>

                  {/* Role dropdown */}
                  <div>
                    <select
                      value={u.role}
                      disabled={isSaving || u.is_suspended}
                      onChange={(e) => handleAction(u.id, "change_role", e.target.value)}
                      style={{ fontSize: 11, fontWeight: 600, backgroundColor: roleCfg.bg, color: roleCfg.color, border: `1px solid ${roleCfg.color}30`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit", width: "100%", opacity: isSaving ? 0.5 : 1 }}
                    >
                      <option value="auditor">Auditor</option>
                      <option value="contributor">Contributor</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>

                  {/* Upload count */}
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0344D8", textAlign: "center" }}>{u.upload_count}</span>

                  {/* Download count */}
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#16A34A", textAlign: "center" }}>{u.download_count}</span>

                  {/* Last active */}
                  <span style={{ fontSize: 11, color: "#6B7280" }}>{formatDate(u.last_sign_in_at)}</span>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6 }}>
                    {u.id === currentUserId ? (
                      <span style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic", padding: "6px 0" }}>Akun Anda</span>
                    ) : u.is_suspended ? (
                      <button
                        onClick={() => handleAction(u.id, "unsuspend")}
                        disabled={isSaving}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid #BBF7D0", backgroundColor: "#F0FDF4", color: "#16A34A", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: isSaving ? 0.5 : 1 }}
                      >
                        {isSaving ? "..." : "✓ Aktifkan"}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (!confirm(`Suspend ${u.full_name || u.email}? User tidak akan bisa login.`)) return;
                          handleAction(u.id, "suspend");
                        }}
                        disabled={isSaving}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid #FECACA", backgroundColor: "#FEF2F2", color: "#DC2626", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: isSaving ? 0.5 : 1 }}
                      >
                        {isSaving ? "..." : "⊘ Suspend"}
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
