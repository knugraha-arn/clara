import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  const { data, error } = await supabase.rpc("search_parties", {
    query: q,
    limit_count: 10,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ambil abbreviation juga
  const ids = (data || []).map((p: { id: string }) => p.id);
  let abbrevMap: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: abbrevData } = await supabase
      .from("parties").select("id, abbreviation").in("id", ids);
    abbrevMap = Object.fromEntries(
      (abbrevData || []).map((p: { id: string; abbreviation: string | null }) => [p.id, p.abbreviation || ""])
    );
  }

  const parties = (data || []).map((p: { id: string; name: string; doc_count: number }) => ({
    ...p,
    abbreviation: abbrevMap[p.id] || "",
  }));

  return NextResponse.json({ parties });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  const { name, abbreviation } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nama party wajib diisi" }, { status: 400 });

  // Cek abbreviation unik
  if (abbreviation?.trim()) {
    const { data: existing } = await supabase
      .from("parties")
      .select("id")
      .ilike("abbreviation", abbreviation.trim())
      .single();
    if (existing) {
      return NextResponse.json({ error: `Kode "${abbreviation.toUpperCase()}" sudah digunakan party lain` }, { status: 409 });
    }
  }

  const { data: party, error } = await supabase
    .from("parties")
    .insert({
      name: name.trim(),
      abbreviation: abbreviation?.trim().toUpperCase() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Party sudah ada" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent({
    supabase: adminSupabase,
    documentTitle: `Pihak: ${party.name}`,
    userId: user.id,
    userEmail: user.email || "",
    userName: profile?.full_name || undefined,
    eventType: "party_created",
    metadata: { party_id: party.id, name: party.name, abbreviation: party.abbreviation },
    request,
  });

  return NextResponse.json({ party });
}
