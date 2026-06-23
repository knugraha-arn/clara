"use client";

import { useState, useEffect, useMemo } from "react";
import { useRole } from "@/components/layout/DashboardShell";
import Image from "next/image";
import type { ComplianceReport, ComplianceControl, ComplianceStandard, ComplianceStatus } from "@/types";
import { useToast } from "@/components/ui/Toast";

const STATUS_CFG: Record<ComplianceStatus, { label: string; color: string; bg: string; icon: string }> = {
  implemented: { label: "Implemented", color: "#16A34A", bg: "#F0FDF4", icon: "✅" },
  partial:     { label: "Partial",     color: "#D97706", bg: "#FFFBEB", icon: "🟡" },
  gap:         { label: "Gap",         color: "#DC2626", bg: "#FEF2F2", icon: "⛔" },
};

const STANDARD_LABEL: Record<ComplianceStandard, string> = {
  iso9001: "ISO 9001:2015",
  iso27001: "ISO 27001:2022",
};

async function generateCompliancePDF(report: ComplianceReport) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());

  doc.setFillColor(3, 68, 216);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("CLARA — Compliance Check ISO 9001 & ISO 27001", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Digenerate: " + now + "  |  CONFIDENTIAL — Arranetwork Internal", 14, 18);

  doc.setTextColor(26, 31, 46);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Ringkasan Skor", 14, 30);

  autoTable(doc, {
    startY: 34,
    head: [["Standar", "Total Kontrol", "Implemented", "Partial", "Gap", "Skor"]],
    body: [
      ["ISO 9001:2015", String(report.summary.iso9001.total), String(report.summary.iso9001.implemented), String(report.summary.iso9001.partial), String(report.summary.iso9001.gap), `${report.summary.iso9001.scorePct}%`],
      ["ISO 27001:2022", String(report.summary.iso27001.total), String(report.summary.iso27001.implemented), String(report.summary.iso27001.partial), String(report.summary.iso27001.gap), `${report.summary.iso27001.scorePct}%`],
      ["Overall", String(report.summary.overall.total), String(report.summary.overall.implemented), String(report.summary.overall.partial), String(report.summary.overall.gap), `${report.summary.overall.scorePct}%`],
    ],
    theme: "grid",
    headStyles: { fillColor: [3, 68, 216], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9 },
    margin: { left: 14 },
  });

  for (const standard of ["iso9001", "iso27001"] as ComplianceStandard[]) {
    doc.addPage();
    doc.setFillColor(3, 68, 216);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Detail Kontrol — ${STANDARD_LABEL[standard]}`, 14, 14);

    const rows = report.controls.filter(c => c.standard === standard).map(c => [
      c.clause,
      c.title,
      STATUS_CFG[c.status].label,
      c.gapNote || c.evidence,
      c.metric ? `${c.metric.label}: ${c.metric.value}` : "-",
    ]);

    autoTable(doc, {
      startY: 30,
      head: [["Klausul", "Kontrol", "Status", "Evidence / Catatan Gap", "Metrik Live"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [3, 68, 216], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 8, cellWidth: "wrap" },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 45 }, 2: { cellWidth: 22 }, 3: { cellWidth: "auto" }, 4: { cellWidth: 45 } },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save(`CLARA-Compliance-ISO-${new Date().toISOString().split("T")[0]}.pdf`);
}

function ScoreCard({ label, summary, color }: { label: string; summary: ComplianceReport["summary"]["overall"]; color: string }) {
  return (
    <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 12, padding: "16px", flex: 1 }}>
      <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 8px" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color }}>{summary.scorePct}%</span>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>skor kepatuhan</span>
      </div>
      <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
        <span style={{ color: "#16A34A" }}>✅ {summary.implemented} implemented</span>
        <span style={{ color: "#D97706" }}>🟡 {summary.partial} partial</span>
        <span style={{ color: "#DC2626" }}>⛔ {summary.gap} gap</span>
      </div>
    </div>
  );
}

function ControlCard({ control }: { control: ComplianceControl }) {
  const cfg = STATUS_CFG[control.status];
  return (
    <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 12, padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", backgroundColor: "#FAFAFA", padding: "2px 7px", borderRadius: 4, flexShrink: 0, marginTop: 2 }}>{control.clause}</span>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>{control.title}</p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, backgroundColor: cfg.bg, padding: "3px 9px", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
          {cfg.icon} {cfg.label}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 8px" }}>{control.description}</p>
      <p style={{ fontSize: 12, color: "#374151", margin: "0 0 6px" }}><strong style={{ color: "#1A1F2E" }}>Evidence: </strong>{control.evidence}</p>
      {control.gapNote && (
        <p style={{ fontSize: 12, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 10px", margin: "0 0 6px" }}>
          <strong>Catatan: </strong>{control.gapNote}
        </p>
      )}
      {control.metric && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 11, fontWeight: 600, color: control.metric.flagged ? "#DC2626" : "#0344D8", backgroundColor: control.metric.flagged ? "#FEF2F2" : "#EEF2FF", padding: "4px 10px", borderRadius: 6 }}>
          {control.metric.flagged ? "⚠️" : "📊"} {control.metric.label}: {control.metric.value}
        </div>
      )}
    </div>
  );
}

export default function CompliancePage() {
  const role = useRole();
  const { error: toastError } = useToast();
  const canView = ["super_admin", "admin"].includes(role);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [standardFilter, setStandardFilter] = useState<ComplianceStandard | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | "all">("all");

  useEffect(() => {
    if (!canView) return;
    fetch("/api/compliance")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setReport(d); setLoading(false); })
      .catch(() => { toastError("Gagal memuat compliance check."); setLoading(false); });
  }, [canView, toastError]);

  const filteredControls = useMemo(() => {
    if (!report) return [];
    return report.controls.filter(c =>
      (standardFilter === "all" || c.standard === standardFilter) &&
      (statusFilter === "all" || c.status === statusFilter)
    );
  }, [report, standardFilter, statusFilter]);

  const handleDownloadPDF = async () => {
    if (!report) return;
    setGeneratingPDF(true);
    try { await generateCompliancePDF(report); }
    finally { setGeneratingPDF(false); }
  };

  if (!canView) {
    return (
      <div style={{ padding: "40px 28px", textAlign: "center", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔒</p>
        <p style={{ fontWeight: 600, color: "#6B7280" }}>Akses ditolak</p>
      </div>
    );
  }

  const today = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid #EFEFEF", backgroundColor: "white" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1F2E", margin: 0 }}>Kepatuhan ISO</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>Checklist internal ISO 9001:2015 & ISO 27001:2022 — bukan klaim sertifikasi</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#9CA3AF" }}>{today}</span>
          <Image src="/arranet-logo-black.png" alt="Arranetwork" width={90} height={22} style={{ opacity: 0.35 }} />
          <button onClick={handleDownloadPDF} disabled={!report || generatingPDF}
            style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#DC2626", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: !report || generatingPDF ? 0.5 : 1 }}>
            {generatingPDF ? "⏳ Generating..." : "📄 Download PDF"}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "#9CA3AF" }}>Memuat compliance check...</div>
      ) : report ? (
        <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Score cards */}
          <div style={{ display: "flex", gap: 12 }}>
            <ScoreCard label="ISO 9001:2015" summary={report.summary.iso9001} color="#0344D8" />
            <ScoreCard label="ISO 27001:2022" summary={report.summary.iso27001} color="#9333EA" />
            <ScoreCard label="Overall" summary={report.summary.overall} color="#16A34A" />
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Filter:</span>
            {(["all", "iso9001", "iso27001"] as const).map(s => (
              <button key={s} onClick={() => setStandardFilter(s)}
                style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: "1px solid " + (standardFilter === s ? "#0344D8" : "#EFEFEF"), backgroundColor: standardFilter === s ? "#EEF2FF" : "white", color: standardFilter === s ? "#0344D8" : "#6B7280", cursor: "pointer", fontFamily: "inherit" }}>
                {s === "all" ? "Semua Standar" : STANDARD_LABEL[s]}
              </button>
            ))}
            <span style={{ width: 1, height: 18, backgroundColor: "#EFEFEF", margin: "0 4px" }} />
            {(["all", "implemented", "partial", "gap"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: "1px solid " + (statusFilter === s ? "#0344D8" : "#EFEFEF"), backgroundColor: statusFilter === s ? "#EEF2FF" : "white", color: statusFilter === s ? "#0344D8" : "#6B7280", cursor: "pointer", fontFamily: "inherit" }}>
                {s === "all" ? "Semua Status" : STATUS_CFG[s as ComplianceStatus].label}
              </button>
            ))}
          </div>

          {/* Control list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredControls.length === 0 ? (
              <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "30px 0" }}>Tidak ada kontrol yang cocok dengan filter ini.</p>
            ) : (
              filteredControls.map(control => <ControlCard key={control.id} control={control} />)
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
