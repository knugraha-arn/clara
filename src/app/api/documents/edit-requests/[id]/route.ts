import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";
import { sendEmail, buildEditDecisionNotificationEmail } from "@/lib/email";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const role = profile?.role || "viewer";

  const { id } = await params;
  const { action, note } = await request.json();

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Action tidak dikenali" }, { status: 400 });
  }

  const { data: editRequest } = await adminSupabase
    .from("document_edit_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!editRequest) return NextResponse.json({ error: "Request tidak ditemukan" }, { status: 404 });
  if (editRequest.status !== "pending") {
    return NextResponse.json({ error: "Request ini sudah diproses sebelumnya" }, { status: 400 });
  }

  // Otorisasi: contributor request -> admin/super_admin boleh approve.
  // admin request -> hanya super_admin yang boleh approve.
  const requiredRoles = editRequest.requested_by_role === "admin" ? ["super_admin"] : ["admin", "super_admin"];
  if (!requiredRoles.includes(role)) {
    return NextResponse.json({ error: "Kamu tidak berwenang menyetujui request ini" }, { status: 403 });
  }

  if (action === "reject" && !note?.trim()) {
    return NextResponse.json({ error: "Catatan penolakan wajib diisi" }, { status: 400 });
  }

  const { data: doc } = await adminSupabase
    .from("documents")
    .select("id, title, user_id")
    .eq("id", editRequest.document_id)
    .single();

  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  const now = new Date().toISOString();
  const newStatus = action === "approve" ? "approved" : "rejected";

  const { error: updateError } = await adminSupabase
    .from("document_edit_requests")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_by_name: profile?.full_name || user.email,
      reviewed_at: now,
      review_note: note?.trim() || null,
    })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Approve: terapkan perubahan ke dokumen
  if (action === "approve") {
    const changes = editRequest.changes as Record<string, { old: unknown; new: unknown }>;
    const updateData: Record<string, unknown> = {};
    for (const [field, { new: newVal }] of Object.entries(changes)) updateData[field] = newVal;
    updateData.updated_at = now;

    const { error: docUpdateError } = await adminSupabase.from("documents").update(updateData).eq("id", editRequest.document_id);
    if (docUpdateError) {
      return NextResponse.json({ error: `Gagal menerapkan perubahan: ${docUpdateError.message}` }, { status: 500 });
    }
  }

  await logEvent({
    supabase: adminSupabase,
    documentId: editRequest.document_id,
    documentTitle: doc.title,
    userId: user.id,
    userEmail: user.email || "",
    userName: profile?.full_name || undefined,
    eventType: action === "approve" ? "edit_approved" : "edit_rejected",
    metadata: { request_id: id, changes: editRequest.changes, note: note?.trim() || null, requested_by: editRequest.requested_by_name },
    request,
  });

  // Email balik ke requester
  const { data: requesterProfile } = await adminSupabase
    .from("profiles")
    .select("email")
    .eq("id", editRequest.requested_by)
    .single();

  if (requesterProfile?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clara.arranetwork.com";
    const html = buildEditDecisionNotificationEmail({
      documentTitle: doc.title,
      approved: action === "approve",
      reviewerName: profile?.full_name || user.email || "Admin",
      reviewNote: note?.trim() || null,
      documentUrl: `${appUrl}/dashboard`,
    });

    const result = await sendEmail({
      to: requesterProfile.email,
      subject: `[CLARA] Permintaan Perubahan Dokumen ${action === "approve" ? "Disetujui" : "Ditolak"}`,
      html,
    });

    if (!result.success) {
      console.error("[EditRequest] Gagal kirim email keputusan ke requester:", result.error);
    }
  }

  return NextResponse.json({ success: true, status: newStatus });
}
