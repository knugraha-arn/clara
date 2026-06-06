import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profileData } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profileData?.role || "auditor";

  const allowedClassifications = role === "super_admin" || role === "admin"
    ? ["public", "internal", "confidential", "restricted"]
    : role === "contributor"
    ? ["public", "internal", "confidential"]
    : ["public", "internal"];

  // Ambil dokumen yang punya valid_until
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, category, classification, valid_until, user_id")
    .in("classification", allowedClassifications)
    .eq("status", "ready")
    .not("valid_until", "is", null)
    .order("valid_until", { ascending: true });

  if (!docs || docs.length === 0) return NextResponse.json({ data: [] });

  // Ambil uploader names
  const userIds = [...new Set(docs.map((d: { user_id: string }) => d.user_id))];
  const { data: profiles } = await supabase
    .from("profiles").select("id, full_name, email").in("id", userIds);
  const profileMap = Object.fromEntries(
    (profiles || []).map((p: { id: string; full_name: string; email: string }) => [p.id, p.full_name || p.email])
  );

  // Ambil parties per dokumen
  const docIds = docs.map((d: { id: string }) => d.id);
  const { data: docParties } = await supabase
    .from("document_parties")
    .select("document_id, parties(name)")
    .in("document_id", docIds);

  type DPRow = { document_id: string; parties: { name: string } | { name: string }[] | null };
  const partyMap: Record<string, string[]> = {};
  (docParties || []).forEach((dp: DPRow) => {
    const name = Array.isArray(dp.parties) ? dp.parties[0]?.name : dp.parties?.name;
    if (name) {
      if (!partyMap[dp.document_id]) partyMap[dp.document_id] = [];
      partyMap[dp.document_id].push(name);
    }
  });

  const result = docs.map((d: { id: string; title: string; category: string; classification: string; valid_until: string; user_id: string }) => {
    const days = Math.ceil((new Date(d.valid_until).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    return {
      id: d.id,
      title: d.title,
      category: d.category,
      classification: d.classification,
      valid_until: d.valid_until,
      uploader_name: profileMap[d.user_id] || "Unknown",
      parties: (partyMap[d.id] || []).join(", "),
      days_remaining: days,
      status: days < 0 ? "berakhir" : days <= 30 ? "segera" : "aktif",
    };
  });

  return NextResponse.json({ data: result });
}
