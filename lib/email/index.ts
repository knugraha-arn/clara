// Helper kirim email lewat Resend REST API.
// Tidak pakai SDK `resend` supaya tidak nambah dependency — cukup fetch langsung,
// konsisten dengan gaya pemanggilan eksternal API lain di project ini.

const RESEND_API_URL = "https://api.resend.com/emails";

interface SendEmailParams {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, cc, subject, html }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.ARNES_PRODUCTION_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL || "ARNES - Arranet Notification Services <arnes-noreply@arranetwork.com>";

  if (!apiKey) {
    console.error("[Email] ARNES_PRODUCTION_KEY tidak diset — email tidak dikirim");
    return { success: false, error: "ARNES_PRODUCTION_KEY tidak diset" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: Array.isArray(to) ? to : [to],
        ...(cc && (Array.isArray(cc) ? cc.length > 0 : true) ? { cc: Array.isArray(cc) ? cc : [cc] } : {}),
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error("[Email] Gagal kirim:", JSON.stringify(errBody));
      return { success: false, error: errBody?.message || `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error("[Email] Error saat kirim:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

const BRAND_COLOR = "#0344D8";
const FONT_STACK = "'DM Sans', system-ui, -apple-system, sans-serif";

function emailShell(bodyContent: string, ctaUrl?: string, ctaLabel?: string): string {
  return `
<div style="font-family: ${FONT_STACK}; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #F8FAFC;">
  <div style="background-color: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <p style="font-size: 13px; font-weight: 700; color: ${BRAND_COLOR}; letter-spacing: 0.05em; text-transform: uppercase; margin: 0 0 16px;">CLARA</p>
    ${bodyContent}
    ${ctaUrl && ctaLabel ? `
    <div style="margin-top: 24px;">
      <a href="${ctaUrl}" style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; padding: 11px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">${ctaLabel}</a>
    </div>` : ""}
  </div>
  <p style="text-align: center; font-size: 11px; color: #9CA3AF; margin-top: 16px;">Email otomatis dari CLARA — Arranetwork Document Management System</p>
</div>`;
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: "Judul Dokumen",
    category: "Kategori",
    summary: "Ringkasan",
    tags: "Tags",
    valid_until: "Berlaku Hingga",
    classification: "Klasifikasi",
  };
  return labels[field] || field;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "<em>(kosong)</em>";
  if (Array.isArray(value)) return value.join(", ") || "<em>(kosong)</em>";
  return String(value);
}

export function buildEditRequestNotificationEmail(params: {
  documentTitle: string;
  requesterName: string;
  requesterRole: string;
  reason: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  approvalUrl: string;
}): string {
  const { documentTitle, requesterName, requesterRole, reason, changes, approvalUrl } = params;

  const changeRows = Object.entries(changes).map(([field, { old, new: newVal }]) => `
    <tr>
      <td style="padding: 8px 12px; font-size: 13px; color: #6B7280; border-bottom: 1px solid #F3F4F6;">${fieldLabel(field)}</td>
      <td style="padding: 8px 12px; font-size: 13px; color: #DC2626; border-bottom: 1px solid #F3F4F6; text-decoration: line-through;">${formatValue(old)}</td>
      <td style="padding: 8px 12px; font-size: 13px; color: #16A34A; border-bottom: 1px solid #F3F4F6; font-weight: 600;">${formatValue(newVal)}</td>
    </tr>`).join("");

  const body = `
    <h2 style="font-size: 18px; color: #1A1F2E; margin: 0 0 8px;">Permintaan Perubahan Dokumen</h2>
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px; line-height: 1.6;">
      <strong>${requesterName}</strong> (${requesterRole}) mengajukan perubahan detail untuk dokumen:
    </p>
    <p style="font-size: 14px; font-weight: 600; color: ${BRAND_COLOR}; margin: 0 0 16px; padding: 10px 14px; background-color: #EEF2FF; border-radius: 8px;">${documentTitle}</p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <thead>
        <tr>
          <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #9CA3AF; text-transform: uppercase;">Field</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #9CA3AF; text-transform: uppercase;">Sebelum</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #9CA3AF; text-transform: uppercase;">Sesudah</th>
        </tr>
      </thead>
      <tbody>${changeRows}</tbody>
    </table>
    <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Alasan perubahan:</p>
    <p style="font-size: 14px; color: #374151; margin: 0; padding: 10px 14px; background-color: #F9FAFB; border-radius: 8px; font-style: italic;">"${reason}"</p>
    <p style="font-size: 13px; color: #6B7280; margin: 20px 0 0;">Silakan tinjau dan ambil keputusan langsung di CLARA.</p>
  `;

  return emailShell(body, approvalUrl, "Tinjau di CLARA →");
}

export function buildEditDecisionNotificationEmail(params: {
  documentTitle: string;
  approved: boolean;
  reviewerName: string;
  reviewNote: string | null;
  documentUrl: string;
}): string {
  const { documentTitle, approved, reviewerName, reviewNote, documentUrl } = params;

  const body = `
    <h2 style="font-size: 18px; color: #1A1F2E; margin: 0 0 8px;">
      Permintaan Perubahan ${approved ? "Disetujui ✅" : "Ditolak ❌"}
    </h2>
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px; line-height: 1.6;">
      Permintaan perubahan kamu untuk dokumen berikut telah <strong>${approved ? "disetujui" : "ditolak"}</strong> oleh ${reviewerName}:
    </p>
    <p style="font-size: 14px; font-weight: 600; color: ${BRAND_COLOR}; margin: 0 0 16px; padding: 10px 14px; background-color: #EEF2FF; border-radius: 8px;">${documentTitle}</p>
    ${reviewNote ? `
    <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Catatan:</p>
    <p style="font-size: 14px; color: #374151; margin: 0; padding: 10px 14px; background-color: #F9FAFB; border-radius: 8px; font-style: italic;">"${reviewNote}"</p>
    ` : ""}
  `;

  return emailShell(body, documentUrl, "Lihat Dokumen →");
}

export function buildNumberRequestNotificationEmail(params: {
  number: string;
  partyName: string;
  description: string;
  date: string;
  requesterName: string;
  requesterRole: string;
  backdatedReason: string | null;
  approvalUrl: string;
}): string {
  const { number, partyName, description, date, requesterName, requesterRole, backdatedReason, approvalUrl } = params;
  const formattedDate = new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const body = `
    <h2 style="font-size: 18px; color: #1A1F2E; margin: 0 0 8px;">Pengajuan Nomor Surat Backdated</h2>
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px; line-height: 1.6;">
      <strong>${requesterName}</strong> (${requesterRole}) mengajukan nomor surat dengan tanggal mundur (backdated) yang perlu persetujuanmu:
    </p>
    <p style="font-size: 14px; font-weight: 600; color: ${BRAND_COLOR}; margin: 0 0 16px; padding: 10px 14px; background-color: #EEF2FF; border-radius: 8px;">${number}</p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <tbody>
        <tr><td style="padding: 6px 0; font-size: 12px; color: #9CA3AF; width: 120px;">Pihak</td><td style="padding: 6px 0; font-size: 13px; color: #374151;">${partyName}</td></tr>
        <tr><td style="padding: 6px 0; font-size: 12px; color: #9CA3AF;">Tanggal Surat</td><td style="padding: 6px 0; font-size: 13px; color: #374151;">${formattedDate}</td></tr>
        <tr><td style="padding: 6px 0; font-size: 12px; color: #9CA3AF;">Perihal</td><td style="padding: 6px 0; font-size: 13px; color: #374151;">${description}</td></tr>
      </tbody>
    </table>
    ${backdatedReason ? `
    <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Alasan backdated:</p>
    <p style="font-size: 14px; color: #374151; margin: 0; padding: 10px 14px; background-color: #F9FAFB; border-radius: 8px; font-style: italic;">"${backdatedReason}"</p>
    ` : ""}
    <p style="font-size: 13px; color: #6B7280; margin: 20px 0 0;">Silakan tinjau dan ambil keputusan langsung di CLARA.</p>
  `;

  return emailShell(body, approvalUrl, "Tinjau di CLARA →");
}

export function buildNumberDecisionNotificationEmail(params: {
  number: string;
  description: string;
  decision: "approved" | "revision" | "rejected" | "void";
  reviewerName: string;
  reviewNote: string | null;
  documentUrl: string;
}): string {
  const { number, description, decision, reviewerName, reviewNote, documentUrl } = params;

  const DECISION_CFG: Record<string, { label: string; verb: string }> = {
    approved: { label: "Disetujui ✅", verb: "disetujui" },
    revision: { label: "Perlu Direvisi 🔄", verb: "dikembalikan untuk direvisi" },
    rejected: { label: "Ditolak ❌", verb: "ditolak" },
    void: { label: "Dibatalkan (Void) ⛔", verb: "dibatalkan (void)" },
  };
  const cfg = DECISION_CFG[decision] || DECISION_CFG.rejected;

  const body = `
    <h2 style="font-size: 18px; color: #1A1F2E; margin: 0 0 8px;">Nomor Surat ${cfg.label}</h2>
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px; line-height: 1.6;">
      Pengajuan nomor surat kamu berikut telah <strong>${cfg.verb}</strong> oleh ${reviewerName}:
    </p>
    <p style="font-size: 14px; font-weight: 600; color: ${BRAND_COLOR}; margin: 0 0 16px; padding: 10px 14px; background-color: #EEF2FF; border-radius: 8px;">${number} — ${description}</p>
    ${reviewNote ? `
    <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Catatan:</p>
    <p style="font-size: 14px; color: #374151; margin: 0; padding: 10px 14px; background-color: #F9FAFB; border-radius: 8px; font-style: italic;">"${reviewNote}"</p>
    ` : ""}
  `;

  return emailShell(body, documentUrl, "Lihat Nomor Surat →");
}

