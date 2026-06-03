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

  // Semua dokumen — tidak filter per user_id
  let query = supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Distinct categories dari semua dokumen
  const { data: catData } = await supabase
    .from("documents")
    .select("category")
    .eq("status", "ready");

  const activeCategories = [...new Set((catData || []).map((d: { category: string }) => d.category))];

  return NextResponse.json({ documents: data, activeCategories });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });

  // Cek dokumen ada, tapi tidak restrict ke user_id — admin bisa hapus semua
  // Kalau mau restrict hanya uploader yang bisa hapus, uncomment baris .eq("user_id", user.id)
  const { data: doc } = await supabase
    .from("documents")
    .select("file_path, user_id")
    .eq("id", id)
    // .eq("user_id", user.id) // uncomment untuk restrict ke uploader saja
    .single();

  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

  await adminSupabase.storage.from("documents").remove([doc.file_path]);

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
