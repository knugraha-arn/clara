import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — daftar user yang pernah upload dokumen (untuk filter pencarian)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ambil distinct user_id dari dokumen ready
  const { data: docs } = await supabase
    .from("documents")
    .select("user_id")
    .eq("status", "ready");

  if (!docs) return NextResponse.json({ uploaders: [] });

  const userIds = [...new Set(docs.map((d: { user_id: string }) => d.user_id))];
  if (userIds.length === 0) return NextResponse.json({ uploaders: [] });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  const uploaders = (profiles || []).map((p: { id: string; full_name: string; email: string }) => ({
    id: p.id,
    name: p.full_name || p.email,
  })).sort((a, b) => a.name.localeCompare(b.name, "id"));

  return NextResponse.json({ uploaders });
}
