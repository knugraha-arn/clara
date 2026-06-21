import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userProfile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const role = userProfile?.role || "viewer";

  const { id } = await params;

  const { data: doc } = await supabase
    .from("documents")
    .select("title, file_path, file_name, classification")
    .eq("id", id)
    .single();

  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  // Cek akses berdasarkan classification + role
  const viewerAllowed = ["public", "internal"];
  const contributorAllowed = ["public", "internal", "confidential"];
  if (role === "viewer" && !viewerAllowed.includes(doc.classification)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  if (["auditor", "contributor"].includes(role) && !contributorAllowed.includes(doc.classification)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  // Preview — signed URL
  const { data: signedUrl, error } = await adminSupabase.storage
    .from("documents")
    .createSignedUrl(doc.file_path, 300); // 5 menit

  if (error || !signedUrl) {
    return NextResponse.json({ error: "Gagal membuat link preview" }, { status: 500 });
  }

  // Log hanya untuk dokumen sensitif (confidential/restricted) — hindari noise di audit trail
  // untuk dokumen public/internal yang risikonya rendah (ISO 27001 A.8.16, proporsional terhadap risiko)
  if (["confidential", "restricted"].includes(doc.classification)) {
    await logEvent({
      supabase: adminSupabase,
      documentId: id,
      documentTitle: doc.title,
      userId: user.id,
      userEmail: user.email || "",
      userName: userProfile?.full_name || undefined,
      eventType: "viewed",
      metadata: { classification: doc.classification },
      request,
    });
  }

  return NextResponse.json({ url: signedUrl.signedUrl });
}
