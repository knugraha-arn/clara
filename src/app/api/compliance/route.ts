import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { COMPLIANCE_CONTROLS } from "@/lib/compliance/controls";
import { runComplianceChecks } from "@/lib/compliance/checks";
import type { ComplianceControl, ComplianceReport, ComplianceStandard, ComplianceSummary } from "@/types";

function summarize(controls: ComplianceControl[]): ComplianceSummary {
  const total = controls.length;
  const implemented = controls.filter(c => c.status === "implemented").length;
  const partial = controls.filter(c => c.status === "partial").length;
  const gap = controls.filter(c => c.status === "gap").length;
  // Partial dihitung setengah poin — lebih jujur daripada dibulatkan ke atas/bawah
  const scorePct = total === 0 ? 0 : Math.round(((implemented + partial * 0.5) / total) * 100);
  return { total, implemented, partial, gap, scorePct };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "super_admin"].includes(profile?.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminSupabase = await createAdminClient();

  let metrics: Awaited<ReturnType<typeof runComplianceChecks>> = {};
  try {
    metrics = await runComplianceChecks(adminSupabase);
  } catch (error) {
    console.error("[Compliance] Gagal menjalankan live checks:", error);
    // Tetap kembalikan static mapping walau live check gagal — lebih baik
    // tampil tanpa angka daripada gagal total.
  }

  const controls: ComplianceControl[] = COMPLIANCE_CONTROLS.map(({ metricId, ...def }) => ({
    ...def,
    metric: metricId ? metrics[metricId] : undefined,
  }));

  const byStandard = (s: ComplianceStandard) => controls.filter(c => c.standard === s);

  const report: ComplianceReport = {
    generatedAt: new Date().toISOString(),
    controls,
    summary: {
      overall: summarize(controls),
      iso9001: summarize(byStandard("iso9001")),
      iso27001: summarize(byStandard("iso27001")),
    },
  };

  return NextResponse.json(report);
}
