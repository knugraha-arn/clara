import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storagePath, classification, overrideReason } = await request.json();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, classification, classification_ai_suggestion")
    .eq("file_path", storagePath)
    .single();

  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  await supabase.from("documents").update({
    classification,
    classification_overridden: true,
    classification_override_reason: overrideReason || null,
    updated_at: new Date().toISOString(),
  }).eq("id", doc.id);

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  await logEvent({
    supabase: adminSupabase,
    documentId: doc.id,
    documentTitle: doc.title,
    userId: user.id,
    userEmail: user.email || "",
    userName: profile?.full_name || undefined,
    eventType: "classification_changed",
    metadata: {
      from: doc.classification_ai_suggestion || doc.classification,
      to: classification,
      reason: overrideReason,
    },
    request,
  });

  return NextResponse.json({ success: true });
}
