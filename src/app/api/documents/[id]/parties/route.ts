import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

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
    .select("party_id, parties(id, name, abbreviation)")
    .eq("document_id", id);

  const parties = (data || []).map((dp: { parties: { id: string; name: string; abbreviation: string | null } | { id: string; name: string; abbreviation: string | null }[] | null }) => {
    const p = Array.isArray(dp.parties) ? dp.parties[0] : dp.parties;
    return p ? { id: p.id, name: p.name, abbreviation: p.abbreviation } : null;
  }).filter(Boolean);

  return NextResponse.json({ parties });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  const { id } = await params;
  const { name, abbreviation } = await request.json();

  // Cek apakah party sudah ada
  const { data: existing } = await supabase
    .from("parties")
    .select("id, name, abbreviation")
    .ilike("name", name.trim())
    .single();

  let partyId: string;

  if (existing) {
    partyId = existing.id;
    // Update abbreviation jika belum ada
    if (!existing.abbreviation && abbreviation?.trim()) {
      await supabase.from("parties").update({
        abbreviation: abbreviation.trim().toUpperCase(),
      }).eq("id", existing.id);
    }
  } else {
    // Buat party baru
    const { data: newParty, error } = await supabase
      .from("parties")
      .insert({
        name: name.trim(),
        abbreviation: abbreviation?.trim().toUpperCase() || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    partyId = newParty.id;

    await logEvent({
      supabase: adminSupabase,
      documentTitle: `Pihak: ${newParty.name}`,
      userId: user.id,
      userEmail: user.email || "",
      userName: profile?.full_name || undefined,
      eventType: "party_created",
      metadata: { party_id: newParty.id, name: newParty.name, abbreviation: newParty.abbreviation, created_via: "document_link" },
      request,
    });
  }

  // Link ke dokumen
  await supabase.from("document_parties").upsert({
    document_id: id,
    party_id: partyId,
  });

  return NextResponse.json({ success: true, partyId });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const role = profile?.role || "viewer";
  if (!["contributor", "admin", "super_admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get("party_id");

  if (!partyId) return NextResponse.json({ error: "party_id required" }, { status: 400 });

  const { data: doc } = await supabase.from("documents").select("title").eq("id", id).single();
  const { data: party } = await supabase.from("parties").select("name").eq("id", partyId).single();

  const { error } = await supabase
    .from("document_parties")
    .delete()
    .eq("document_id", id)
    .eq("party_id", partyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent({
    supabase: adminSupabase,
    documentId: id,
    documentTitle: doc?.title || "Unknown",
    userId: user.id,
    userEmail: user.email || "",
    userName: profile?.full_name || undefined,
    eventType: "party_unlinked",
    metadata: { party_id: partyId, party_name: party?.name || "Unknown" },
    request,
  });

  return NextResponse.json({ success: true });
}
