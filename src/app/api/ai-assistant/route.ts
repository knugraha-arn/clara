import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedSearchQuery } from "@/lib/gemini";
import OpenAI from "openai";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DAILY_LIMITS: Record<string, number> = {
  auditor: 20,
  contributor: 30,
  admin: 50,
  super_admin: 999999,
};

export async function GET() {
  // Ambil usage hari ini
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role || "auditor";
  const limit = DAILY_LIMITS[role] || 20;

  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("ai_usage")
    .select("count")
    .eq("user_id", user.id)
    .eq("usage_date", today)
    .single();

  const used = usage?.count || 0;

  return NextResponse.json({ used, limit, remaining: Math.max(0, limit - used) });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const userRole = profile?.role || "auditor";
  const limit = DAILY_LIMITS[userRole] || 20;

  // Cek usage hari ini
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("ai_usage")
    .select("count")
    .eq("user_id", user.id)
    .eq("usage_date", today)
    .single();

  const used = usage?.count || 0;
  if (used >= limit) {
    return NextResponse.json({
      error: `Batas harian tercapai (${limit} pertanyaan). Reset besok.`,
      limitReached: true,
    }, { status: 429 });
  }

  const { question, history = [] } = await request.json();
  if (!question?.trim()) return NextResponse.json({ error: "Pertanyaan diperlukan" }, { status: 400 });

  // Increment usage
  if (usage) {
    await supabase.from("ai_usage").update({ count: used + 1, updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("usage_date", today);
  } else {
    await supabase.from("ai_usage").insert({ user_id: user.id, usage_date: today, count: 1 });
  }

  const allowedClassifications = userRole === "super_admin" || userRole === "admin"
    ? ["public", "internal", "confidential", "restricted"]
    : userRole === "contributor"
    ? ["public", "internal", "confidential"]
    : ["public", "internal"];

  // Semantic search untuk konteks
  let documentContext = "";
  try {
    const queryEmbedding = await embedSearchQuery(question);
    const { data: semanticResults } = await supabase.rpc("search_documents_semantic_all", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.3,
      match_count: 8,
    });

    if (semanticResults?.length > 0) {
      const docIds = [...new Set(semanticResults.map((r: { document_id: string }) => r.document_id))];
      const { data: docs } = await supabase
        .from("documents")
        .select("id, title, summary, category, classification, retention_date, created_at, tags")
        .in("id", docIds)
        .in("classification", allowedClassifications);

      if (docs && docs.length > 0) {
        const docMap = Object.fromEntries(docs.map((d: {
          id: string; title: string; summary: string | null; category: string;
          classification: string; retention_date: string | null; created_at: string; tags: string[];
        }) => [d.id, d]));

        const relevantChunks = semanticResults
          .filter((r: { document_id: string }) => docMap[r.document_id])
          .slice(0, 5);

        documentContext = relevantChunks.map((r: { document_id: string; chunk_text: string }) => {
          const doc = docMap[r.document_id];
          if (!doc) return "";
          return `--- DOKUMEN: "${doc.title}" ---
Kategori: ${doc.category} | Klasifikasi: ${doc.classification}
Retensi: ${doc.retention_date || "tidak diset"}
Ringkasan: ${doc.summary || "-"}
Konten: ${r.chunk_text}`;
        }).filter(Boolean).join("\n\n");
      }
    }
  } catch (e) {
    console.error("[AI] Search error:", e);
  }

  // Metadata statistik
  const { data: allDocs } = await supabase
    .from("documents")
    .select("title, category, classification, retention_date, created_at, is_scanned")
    .in("classification", allowedClassifications)
    .eq("status", "ready");

  const metaContext = `
RINGKASAN ARSIP CLARA (data real-time):
- Total dokumen: ${allDocs?.length || 0}
- Per kategori: ${JSON.stringify((allDocs || []).reduce((acc: Record<string, number>, d: { category: string }) => { acc[d.category] = (acc[d.category] || 0) + 1; return acc; }, {}))}
- Dokumen scan: ${(allDocs || []).filter((d: { is_scanned: boolean }) => d.is_scanned).length}
- Expired bulan ini: ${(allDocs || []).filter((d: { retention_date: string | null }) => {
    if (!d.retention_date) return false;
    const diff = (new Date(d.retention_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length}`;

  const systemPrompt = `Kamu adalah CLARA AI Assistant — asisten manajemen dokumen arsip untuk organisasi Arranetwork.

IDENTITAS:
- Nama: CLARA AI Assistant
- Basis data: Arsip dokumen CLARA milik Arranetwork
- Bahasa: Indonesia (profesional dan ringkas)

YANG BISA KAMU LAKUKAN ✅:
- Menjawab pertanyaan tentang dokumen di arsip CLARA
- Memberikan informasi metadata dokumen (kategori, klasifikasi, tanggal, uploader)
- Informasi retensi & status dokumen
- Statistik arsip
- Rekomendasi tindakan (dokumen expired, perlu review, dll)
- Pencarian konseptual isi dokumen

YANG TIDAK BISA KAMU LAKUKAN ❌:
- Menjawab pertanyaan di luar konteks arsip CLARA
- Generate kode atau artefak
- Mengakses internet atau data eksternal
- Menampilkan isi verbatim dokumen Confidential/Restricted
- Mengakses dokumen di luar hak akses role: ${allowedClassifications.join(", ")}

${metaContext}

${documentContext ? `DOKUMEN RELEVAN:\n${documentContext}` : "Tidak ada dokumen yang spesifik relevan, jawab berdasarkan metadata arsip di atas."}`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-6).map((h: { role: string; content: string }) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user" as const, content: question },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.3,
    max_tokens: 800,
  });

  const answer = response.choices[0].message.content || "Maaf, tidak dapat memproses pertanyaan ini.";

  await supabase.from("search_history").insert({
    user_id: user.id,
    query: `[AI] ${question}`,
    result_count: 1,
  });

  return NextResponse.json({
    answer,
    hasContext: !!documentContext,
    usage: { used: used + 1, limit, remaining: Math.max(0, limit - used - 1) },
  });
}
