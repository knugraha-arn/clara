import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data: documents, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ambil nama uploader untuk semua dokumen
  const userIds = [...new Set((documents || []).map((d: { user_id: string }) => d.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  const profileMap = Object.fromEntries(
    (profiles || []).map((p: { id: string; full_name: string; email: string }) => [p.id, p.full_name || p.email])
  );

  const documentsWithUploader = (documents || []).map((doc: { user_id: string }) => ({
    ...doc,
    uploader_name: profileMap[doc.user_id] || "Unknown",
  }));

  // Active categories
  const { data: catData } = await supabase
    .from("documents")
    .select("category")
    .eq("status", "ready");

  const activeCategories = [...new Set((catData || []).map((d: { category: string }) => d.category))];

  return NextResponse.json({ documents: documentsWithUploader, activeCategories });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });

  const { data: doc } = await supabase
    .from("documents")
    .select("file_path, user_id, title")
    .eq("id", id)
    .single();

  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  await adminSupabase.storage.from("documents").remove([doc.file_path]);
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
