import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!["contributor", "admin", "super_admin"].includes(profile?.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { storagePath, classification, category, summary, validUntil, overrideReason } = await request.json();

  const { data: doc } = await adminSupabase
    .from("documents")
    .select("id, title, classification, classification_ai_suggestion, category, file_size, page_count")
    .eq("file_path", storagePath)
    .single();

  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  const updateData: Record<string, unknown> = {
    status: "ready",  // dokumen resmi tersimpan saat user konfirmasi
    updated_at: new Date().toISOString(),
  };

  if (summary !== undefined && summary !== null) {
    updateData.summary = summary;
  }

  updateData.valid_until = validUntil || null;

  const isClassificationChanged = classification && classification !== doc.classification;
  if (isClassificationChanged) {
    updateData.classification = classification;
    updateData.classification_overridden = true;
    updateData.classification_override_reason = overrideReason || null;
  }

  if (category && category !== doc.category) {
    updateData.category = category;
    updateData.category_overridden = true;
    updateData.category_ai_suggestion = doc.category;
  }

  const { data: updatedRows, error: updateError } = await adminSupabase
    .from("documents")
    .update(updateData)
    .eq("id", doc.id)
    .select();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ error: "Dokumen tidak dapat diperbarui (kemungkinan diblokir RLS atau bukan pemilik dokumen)" }, { status: 403 });
  }

  // Log audit uploaded — dicatat saat konfirmasi
  await logEvent({
    supabase: adminSupabase,
    documentId: doc.id,
    documentTitle: doc.title,
    userId: user.id,
    userEmail: user.email || "",
    userName: profile?.full_name || undefined,
    eventType: "uploaded",
    metadata: {
      category: (category && category !== doc.category) ? category : doc.category,
      classification: isClassificationChanged ? classification : doc.classification,
      classification_overridden: isClassificationChanged,
      file_size: doc.file_size,
      page_count: doc.page_count,
    },
    request,
  });

  // Log classification_changed jika ada perubahan dari saran AI
  if (isClassificationChanged || (category && category !== doc.category)) {
    await logEvent({
      supabase: adminSupabase,
      documentId: doc.id,
      documentTitle: doc.title,
      userId: user.id,
      userEmail: user.email || "",
      userName: profile?.full_name || undefined,
      eventType: "classification_changed",
      metadata: {
        classification_from: doc.classification_ai_suggestion || doc.classification,
        classification_to: classification || doc.classification,
        category_from: doc.category,
        category_to: category || doc.category,
        reason: overrideReason,
      },
      request,
    });
  }

  return NextResponse.json({ success: true });
}
