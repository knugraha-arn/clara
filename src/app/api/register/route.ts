import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // active, expiring, expired
  const classification = searchParams.get("classification");
  const category = searchParams.get("category");

  let query = supabase.from("master_document_register").select("*");

  if (status === "expiring") query = query.eq("status_retensi", "Expiring Soon");
  else if (status === "expired") query = query.eq("status_retensi", "Expired");
  else if (status === "active") query = query.eq("status_retensi", "Active");

  if (classification) query = query.ilike("klasifikasi", classification);
  if (category) query = query.ilike("kategori", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ documents: data, total: data?.length || 0 });
}
