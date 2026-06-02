import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: doc } = await supabase
    .from("documents")
    .select("file_path, file_name")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  // Generate signed URL (valid 60 detik)
  const { data: signedUrl, error } = await adminSupabase.storage
    .from("documents")
    .createSignedUrl(doc.file_path, 60);

  if (error || !signedUrl) {
    return NextResponse.json({ error: "Gagal membuat link download" }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrl.signedUrl, fileName: doc.file_name });
}
