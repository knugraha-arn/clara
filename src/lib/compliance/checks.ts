import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComplianceMetric } from "@/types";

/**
 * Live checks — query data aktual supaya compliance report bukan cuma
 * klaim statis ("sudah implemented") tapi juga nunjukin kondisi riil saat ini.
 * Semua query read-only, pakai admin client karena lintas-user (mis. semua
 * dokumen, semua edit request), bukan scoped ke satu user.
 */

export type ComplianceMetrics = Record<string, ComplianceMetric>;

// Kategori yang menurut aturan AI classification HARUS restricted
const HIGH_RISK_CATEGORIES = ["invoice", "po", "berita_acara"];

export async function runComplianceChecks(supabase: SupabaseClient): Promise<ComplianceMetrics> {
  const metrics: ComplianceMetrics = {};

  // 1. Backlog edit request pending > 7 hari (ISO 9001 §7.5.3)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [{ count: pendingTotal }, { count: pendingOverdue }] = await Promise.all([
    supabase.from("document_edit_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("document_edit_requests").select("id", { count: "exact", head: true })
      .eq("status", "pending").lt("requested_at", sevenDaysAgo.toISOString()),
  ]);

  metrics.editRequestBacklog = {
    label: "Edit request pending",
    value: `${pendingTotal || 0} total, ${pendingOverdue || 0} > 7 hari`,
    flagged: (pendingOverdue || 0) > 0,
  };

  // 2. Volume audit log (bukti logging aktif) — ISO 9001 §8.5.2 / ISO 27001 A.8.15
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [{ count: logTotal }, { count: log30d }] = await Promise.all([
    supabase.from("document_logs").select("id", { count: "exact", head: true }),
    supabase.from("document_logs").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

  metrics.auditLogVolume = {
    label: "Total audit log",
    value: `${logTotal || 0} (${log30d || 0} dalam 30 hari)`,
    flagged: (logTotal || 0) === 0,
  };

  // 3. Dokumen expired tapi tidak ditandai apa pun selain status warna di Statistik
  const today = new Date().toISOString().split("T")[0];
  const { count: expiredCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "ready")
    .lt("valid_until", today)
    .not("valid_until", "is", null);

  metrics.expiredUnflagged = {
    label: "Dokumen lewat masa berlaku",
    value: expiredCount || 0,
    flagged: (expiredCount || 0) > 0,
  };

  // 4. Pelanggaran aturan klasifikasi: kategori high-risk tapi bukan restricted
  const { count: violationCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "ready")
    .in("category", HIGH_RISK_CATEGORIES)
    .neq("classification", "restricted");

  metrics.classificationPolicyViolations = {
    label: "Dokumen high-risk salah klasifikasi",
    value: violationCount || 0,
    flagged: (violationCount || 0) > 0,
  };

  // 5. Event privileged tercatat 90 hari terakhir (bukti monitoring aktif) — A.8.16
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { count: privilegedCount } = await supabase
    .from("document_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", ninetyDaysAgo.toISOString())
    .in("event_type", [
      "role_changed", "user_suspended", "user_unsuspended",
      "number_approved", "number_rejected", "number_voided",
      "edit_approved", "edit_rejected", "edit_auto_approved",
      "party_unlinked",
    ]);

  metrics.privilegedEvents90d = {
    label: "Event privileged (90 hari)",
    value: privilegedCount || 0,
  };

  // 6. Dokumen ready tanpa retention_date — A.8.10
  const { count: missingRetention } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "ready")
    .is("retention_date", null);

  metrics.documentsMissingRetention = {
    label: "Dokumen tanpa retention date",
    value: missingRetention || 0,
    flagged: (missingRetention || 0) > 0,
  };

  return metrics;
}
