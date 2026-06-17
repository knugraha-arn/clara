import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const page     = Math.max(1, parseInt(searchParams.get("page")   || "1"));
  const pageSize = Math.min(100, parseInt(searchParams.get("limit") || "10"));
  const sortKey  = searchParams.get("sort")  || "created_at";
  const sortDir  = searchParams.get("dir")   === "asc";
  const offset   = (page - 1) * pageSize;

  const allowedSortKeys = ["created_at", "title", "category", "file_size", "classification"];
  const safeSortKey = allowedSortKeys.includes(sortKey) ? sortKey : "created_at";

  let query = supabase
    .from("documents")
    .select("*", { count: "exact" })
    .order(safeSortKey, { ascending: sortDir })
    .range(offset, offset + pageSize - 1);

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data: documents, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ambil nama uploader
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

  // Active categories (hanya fetch sekali saat page=1 & tanpa filter kategori)
  let activeCategories: string[] = [];
  if (page === 1 && (!category || category === "all")) {
    const { data: catData } = await supabase
      .from("documents")
      .select("category")
      .eq("status", "ready");
    activeCategories = [...new Set((catData || []).map((d: { category: string }) => d.category))];
  }

  return NextResponse.json({
    documents: documentsWithUploader,
    activeCategories,
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  });
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
