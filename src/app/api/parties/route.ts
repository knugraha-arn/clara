import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — autocomplete search parties
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const documentId = searchParams.get("document_id");

  if (q.length === 0) {
    // Return recently used parties (top 10 by doc count)
    const { data } = await supabase.rpc("search_parties", { query: "", limit_count: 10 });
    return NextResponse.json({ parties: data || [] });
  }

  const { data } = await supabase.rpc("search_parties", { query: q, limit_count: 10 });
  
  // Kalau ada documentId, filter out yang sudah ditambahkan
  if (documentId && data) {
    const { data: existing } = await supabase
      .from("document_parties")
      .select("party_id")
      .eq("document_id", documentId);
    
    const existingIds = new Set((existing || []).map((e: { party_id: string }) => e.party_id));
    return NextResponse.json({ parties: data.filter((p: { id: string }) => !existingIds.has(p.id)) });
  }

  return NextResponse.json({ parties: data || [] });
}

// POST — tambah party baru atau get existing, lalu link ke dokumen
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, documentId } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nama diperlukan" }, { status: 400 });

  const trimmedName = name.trim();

  // Upsert party (insert atau return existing)
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .upsert({ name: trimmedName, created_by: user.id }, { onConflict: "name_lower" })
    .select()
    .single();

  if (partyError || !party) {
    // Coba ambil yang sudah ada
    const { data: existing } = await supabase
      .from("parties")
      .select("*")
      .ilike("name", trimmedName)
      .single();
    
    if (!existing) return NextResponse.json({ error: "Gagal menyimpan party" }, { status: 500 });

    // Link ke dokumen jika ada
    if (documentId) {
      await supabase.from("document_parties").upsert({
        document_id: documentId,
        party_id: existing.id,
      }, { onConflict: "document_id,party_id" });
    }
    return NextResponse.json({ party: existing });
  }

  // Link ke dokumen jika ada
  if (documentId) {
    await supabase.from("document_parties").upsert({
      document_id: party.id,
      party_id: party.id,
    }, { onConflict: "document_id,party_id" });
  }

  return NextResponse.json({ party });
}
