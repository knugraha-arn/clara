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

  // Viewer tidak bisa download
  const { data: userProfile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (userProfile?.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengunduh dokumen" }, { status: 403 });
  }

  const { id } = await params;

  const { data: doc } = await supabase
    .from("documents")
    .select("file_path, file_name, title, classification")
    .eq("id", id)
    .single();

  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  const { data: fileData, error } = await adminSupabase.storage
    .from("documents").download(doc.file_path);

  if (error || !fileData) {
    return NextResponse.json({ error: "Gagal mengunduh file" }, { status: 500 });
  }

  await logEvent({
    supabase: adminSupabase,
    documentId: id,
    documentTitle: doc.title,
    userId: user.id,
    userEmail: user.email || "",
    userName: userProfile?.full_name || undefined,
    eventType: "downloaded",
    metadata: { classification: doc.classification, file_name: doc.file_name },
    request,
  });

  const arrayBuffer = await fileData.arrayBuffer();
  const encodedFileName = encodeURIComponent(doc.file_name);

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.file_name}"; filename*=UTF-8''${encodedFileName}`,
      "Content-Length": arrayBuffer.byteLength.toString(),
    },
  });
}
