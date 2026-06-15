import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const ROMAN = ["", "I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

// GET — list semua nomor surat
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const year = searchParams.get("year");
  const category = searchParams.get("category");
  const partyId = searchParams.get("party_id");

  let query = supabase
    .from("document_numbers")
    .select("*")
    .order("date", { ascending: false })
    .order("sequence", { ascending: false });

  if (status) query = query.eq("status", status);
  if (year) query = query.eq("year", parseInt(year));
  if (category) query = query.eq("category", category);
  if (partyId) query = query.eq("party_id", partyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hitung pending count untuk badge
  const { count: pendingCount } = await supabase
    .from("document_numbers")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return NextResponse.json({ numbers: data || [], pendingCount: pendingCount || 0 });
}

// POST — buat nomor surat baru
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role, full_name").eq("id", user.id).single();

  if (!["contributor", "admin", "super_admin"].includes(profile?.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { partyId, partyName, date, category, classification, description } = await request.json();

  if (!partyName || !date || !category || !classification || !description) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }

  const docDate = new Date(date);
  const month = docDate.getMonth() + 1;
  const year = docDate.getFullYear();
  const today = new Date();
  today.setHours(0,0,0,0);
  docDate.setHours(0,0,0,0);

  const isBackdated = docDate < today;

  // Hitung sequence — selalu ambil max sequence tahun ini (termasuk void/rejected)
  // untuk menghindari duplicate key
  const { data: lastInYear } = await supabase
    .from("document_numbers")
    .select("sequence")
    .eq("year", year)
    .order("sequence", { ascending: false })
    .limit(1);

  const maxSequenceThisYear = lastInYear?.[0]?.sequence || 0;

  // Untuk backdated: masukkan di urutan tanggal yang tepat
  let sequence: number;
  if (isBackdated) {
    // Ambil sequence terakhir sebelum tanggal backdated (exclude void/rejected)
    const { data: beforeDate } = await supabase
      .from("document_numbers")
      .select("sequence")
      .eq("year", year)
      .lte("date", date)
      .not("status", "in", '("rejected","void")')
      .order("sequence", { ascending: false })
      .limit(1);

    const lastBefore = beforeDate?.[0]?.sequence || 0;

    // Geser semua nomor aktif setelah tanggal ini +1
    const { data: afterNums } = await supabase
      .from("document_numbers")
      .select("id, sequence, number, party_name, month, year")
      .eq("year", year)
      .gt("date", date)
      .not("status", "in", '("rejected","void")')
      .order("sequence", { ascending: true });

    if (afterNums && afterNums.length > 0) {
      for (const num of afterNums) {
        const newSeq = num.sequence + 1;
        const newNumber = String(newSeq).padStart(3, "0") + "/" + num.party_name + "/" + ROMAN[num.month] + "/" + num.year;
        await adminSupabase.from("document_numbers")
          .update({ sequence: newSeq, number: newNumber, updated_at: new Date().toISOString() })
          .eq("id", num.id);
      }
    }

    // Sequence baru = lastBefore + 1, tapi minimal maxSequenceThisYear + 1
    sequence = Math.max(lastBefore + 1, maxSequenceThisYear + 1);
  } else {
    sequence = maxSequenceThisYear + 1;
  }

  const paddedSeq = String(sequence).padStart(3, "0");
  const romanMonth = ROMAN[month];
  // partyName sudah berisi abbreviation dari frontend
  const number = `${paddedSeq}/${partyName}/${romanMonth}/${year}`;

  // Status: backdated contributor = pending, admin+ = issued, tidak backdated = issued
  const status = isBackdated && profile?.role === "contributor" ? "pending" : "issued";

  const { data: docNum, error } = await supabase
    .from("document_numbers")
    .insert({
      number,
      sequence,
      year,
      month,
      date,
      party_id: partyId || null,
      party_name: partyName,
      category,
      classification,
      description,
      status,
      is_backdated: isBackdated,
      created_by: user.id,
      created_by_name: profile?.full_name || user.email,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ number: docNum, isBackdated, status });
}
