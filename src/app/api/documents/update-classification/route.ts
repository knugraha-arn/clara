import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storagePath, classification, category, summary, overrideReason } = await request.json();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, classification, classification_ai_suggestion, category")
    .eq("file_path", storagePath)
    .single();

  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Update klasifikasi jika berubah
  if (classification && classification !== doc.classification) {
    updateData.classification = classification;
    updateData.classification_overridden = true;
    updateData.classification_override_reason = overrideReason || null;
  }

  // Update kategori jika berubah
  if (category && category !== doc.category) {
    updateData.category = category;
    updateData.category_overridden = true;
    updateData.category_ai_suggestion = doc.category; // simpan AI suggestion lama
  }

  if (Object.keys(updateData).length > 1) {
    await supabase.from("documents").update(updateData).eq("id", doc.id);
  }

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  // Log audit jika ada perubahan
  if (updateData.classification || updateData.category) {
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
