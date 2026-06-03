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

  const { id } = await params;

  const { data: doc } = await supabase
    .from("documents")
    .select("file_path, file_name, title, classification")
    .eq("id", id)
    .single();

  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  // Download file dari storage
  const { data: fileData, error } = await adminSupabase.storage
    .from("documents")
    .download(doc.file_path);

  if (error || !fileData) {
    return NextResponse.json({ error: "Gagal mengunduh file" }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Log audit — hanya untuk force download
  await logEvent({
    supabase: adminSupabase,
    documentId: id,
    documentTitle: doc.title,
    userId: user.id,
    userEmail: user.email || "",
    userName: profile?.full_name || undefined,
    eventType: "downloaded",
    metadata: { classification: doc.classification, file_name: doc.file_name },
    request,
  });

  // Force download dengan nama file asli
  const arrayBuffer = await fileData.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.file_name)}"`,
      "Content-Length": arrayBuffer.byteLength.toString(),
    },
  });
}
