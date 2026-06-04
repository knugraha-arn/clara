import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — list parties untuk dokumen tertentu
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data } = await supabase
    .from("document_parties")
    .select("party_id, parties(id, name)")
    .eq("document_id", id);

  const parties = (data || []).map((dp: { parties: { id: string; name: string } | { id: string; name: string }[] | null }) => {
    const p = Array.isArray(dp.parties) ? dp.parties[0] : dp.parties;
    return p;
  }).filter(Boolean);

  return NextResponse.json({ parties });
}

// POST — tambah party ke dokumen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: documentId } = await params;
  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nama diperlukan" }, { status: 400 });

  const trimmedName = name.trim();

  // Cari atau buat party
  let party;
  const { data: existing } = await supabase
    .from("parties")
    .select("*")
    .ilike("name", trimmedName)
    .single();

  if (existing) {
    party = existing;
  } else {
    const { data: newParty } = await supabase
      .from("parties")
      .insert({ name: trimmedName, created_by: user.id })
      .select()
      .single();
    party = newParty;
  }

  if (!party) return NextResponse.json({ error: "Gagal membuat party" }, { status: 500 });

  // Link ke dokumen
  await supabase.from("document_parties").upsert({
    document_id: documentId,
    party_id: party.id,
  }, { onConflict: "document_id,party_id" });

  return NextResponse.json({ party });
}

// DELETE — hapus party dari dokumen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: documentId } = await params;
  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get("party_id");
  if (!partyId) return NextResponse.json({ error: "party_id diperlukan" }, { status: 400 });

  await supabase.from("document_parties")
    .delete()
    .eq("document_id", documentId)
    .eq("party_id", partyId);

  return NextResponse.json({ success: true });
}
