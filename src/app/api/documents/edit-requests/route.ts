import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";
import { sendEmail, buildEditRequestNotificationEmail } from "@/lib/email";
import type { DocumentEditableFields } from "@/types";

const EDITABLE_FIELDS = ["title", "category", "summary", "tags", "valid_until", "classification"] as const;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  const role = profile?.role || "viewer";
  if (!["contributor", "admin", "super_admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { documentId, fields, reason } = body as { documentId: string; fields: DocumentEditableFields; reason: string };

  if (!documentId) return NextResponse.json({ error: "documentId diperlukan" }, { status: 400 });
  if (!reason?.trim()) return NextResponse.json({ error: "Alasan perubahan wajib diisi" }, { status: 400 });
  if (!fields || Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan yang diajukan" }, { status: 400 });
  }

  const { data: doc } = await adminSupabase
    .from("documents")
    .select("id, title, category, summary, tags, valid_until, classification")
    .eq("id", documentId)
    .single();

  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  // Bangun objek changes — hanya field yang benar-benar berubah
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in fields) {
      const oldVal = doc[field as keyof typeof doc];
      const newVal = fields[field];
      const changed = field === "tags"
        ? JSON.stringify(oldVal) !== JSON.stringify(newVal)
        : oldVal !== newVal;
      if (changed) changes[field] = { old: oldVal, new: newVal };
    }
  }

  // Klasifikasi itu security-sensitive (ISO 27001 A.5.12) — validasi ketat di server,
  // jangan cuma percaya UI, karena field ini bisa saja dipanggil langsung lewat API.
  if ("classification" in changes) {
    const validClassifications = ["public", "internal", "confidential", "restricted"];
    if (!validClassifications.includes(String(changes.classification.new))) {
      return NextResponse.json({ error: "Klasifikasi tidak valid" }, { status: 400 });
    }
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan dari nilai saat ini" }, { status: 400 });
  }

  const isSuperAdmin = role === "super_admin";
  const now = new Date().toISOString();

  const { data: editRequest, error: insertError } = await adminSupabase
    .from("document_edit_requests")
    .insert({
      document_id: documentId,
      requested_by: user.id,
      requested_by_name: profile?.full_name || user.email,
      requested_by_role: role,
      changes,
      reason: reason.trim(),
      status: isSuperAdmin ? "approved" : "pending",
      auto_approved: isSuperAdmin,
      reviewed_by: isSuperAdmin ? user.id : null,
      reviewed_by_name: isSuperAdmin ? (profile?.full_name || user.email) : null,
      reviewed_at: isSuperAdmin ? now : null,
      review_note: isSuperAdmin ? "Auto-approved (super_admin)" : null,
    })
    .select()
    .single();

  if (insertError || !editRequest) {
    return NextResponse.json({ error: insertError?.message || "Gagal membuat request" }, { status: 500 });
  }

  // Super_admin: langsung terapkan perubahan ke dokumen
  if (isSuperAdmin) {
    const updateData: Record<string, unknown> = {};
    for (const [field, { new: newVal }] of Object.entries(changes)) updateData[field] = newVal;
    updateData.updated_at = now;

    await adminSupabase.from("documents").update(updateData).eq("id", documentId);

    await logEvent({
      supabase: adminSupabase,
      documentId,
      documentTitle: doc.title,
      userId: user.id,
      userEmail: user.email || "",
      userName: profile?.full_name || undefined,
      eventType: "edit_auto_approved",
      metadata: { request_id: editRequest.id, changes, reason: reason.trim() },
      request,
    });

    return NextResponse.json({ editRequest, autoApproved: true });
  }

  // Contributor/Admin: log request, kirim email ke yang berwenang approve
  await logEvent({
    supabase: adminSupabase,
    documentId,
    documentTitle: doc.title,
    userId: user.id,
    userEmail: user.email || "",
    userName: profile?.full_name || undefined,
    eventType: "edit_requested",
    metadata: { request_id: editRequest.id, changes, reason: reason.trim() },
    request,
  });

  // Contributor -> To: admin, CC: super_admin. Admin -> To: super_admin saja.
  const toRoles = role === "admin" ? ["super_admin"] : ["admin"];
  const ccRoles = role === "admin" ? [] : ["super_admin"];

  const { data: toProfiles } = await adminSupabase.from("profiles").select("email").in("role", toRoles);
  const toEmails = (toProfiles || []).map(a => a.email).filter(Boolean);

  let ccEmails: string[] = [];
  if (ccRoles.length > 0) {
    const { data: ccProfiles } = await adminSupabase.from("profiles").select("email").in("role", ccRoles);
    ccEmails = (ccProfiles || []).map(a => a.email).filter(Boolean);
  }

  if (toEmails.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clara.arranetwork.com";
    const html = buildEditRequestNotificationEmail({
      documentTitle: doc.title,
      requesterName: profile?.full_name || user.email || "Unknown",
      requesterRole: role,
      reason: reason.trim(),
      changes,
      approvalUrl: `${appUrl}/dashboard/edit-requests`,
    });

    const result = await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: "[CLARA] Persetujuan Perubahan Metadata Dokumen",
      html,
    });

    if (!result.success) {
      console.error("[EditRequest] Gagal kirim email notifikasi:", result.error);
      // Tidak menggagalkan request — email gagal bukan alasan menolak permintaan user
    }
  }

  return NextResponse.json({ editRequest, autoApproved: false });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const documentId = searchParams.get("document_id");

  let query = supabase
    .from("document_edit_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (documentId) query = query.eq("document_id", documentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ requests: data || [] });
}
