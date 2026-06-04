import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedSearchQuery } from "@/lib/gemini";
import OpenAI from "openai";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, history = [] } = await request.json();
  if (!question?.trim()) return NextResponse.json({ error: "Pertanyaan diperlukan" }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const userRole = profile?.role || "auditor";

  // Tentukan klasifikasi yang boleh diakses berdasarkan role
  const allowedClassifications = userRole === "super_admin" || userRole === "admin"
    ? ["public", "internal", "confidential", "restricted"]
    : userRole === "contributor"
    ? ["public", "internal", "confidential"]
    : ["public", "internal"]; // auditor

  // 1. Semantic search untuk ambil konteks dokumen relevan
  let documentContext = "";
  try {
    const queryEmbedding = await embedSearchQuery(question);
    const { data: semanticResults } = await supabase.rpc("search_documents_semantic_all", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.3,
      match_count: 8,
    });

    if (semanticResults?.length > 0) {
      // Filter by allowed classifications
      const docIds = [...new Set(semanticResults.map((r: { document_id: string }) => r.document_id))];
      const { data: docs } = await supabase
        .from("documents")
        .select("id, title, summary, category, classification, retention_date, created_at, tags")
        .in("id", docIds)
        .in("classification", allowedClassifications);

      if (docs && docs.length > 0) {
        const docMap = Object.fromEntries(docs.map((d: { id: string; title: string; summary: string | null; category: string; classification: string; retention_date: string | null; created_at: string; tags: string[] }) => [d.id, d]));
        const relevantChunks = semanticResults
          .filter((r: { document_id: string }) => docMap[r.document_id])
          .slice(0, 5);

        documentContext = relevantChunks.map((r: { document_id: string; chunk_text: string; similarity: number }) => {
          const doc = docMap[r.document_id];
          if (!doc) return "";
          return `--- DOKUMEN: "${doc.title}" ---
Kategori: ${doc.category} | Klasifikasi: ${doc.classification}
Retensi: ${doc.retention_date || "tidak diset"}
Ringkasan: ${doc.summary || "-"}
Konten relevan: ${r.chunk_text}`;
        }).filter(Boolean).join("\n\n");
      }
    }
  } catch (e) {
    console.error("[AI Assistant] Search error:", e);
  }

  // 2. Ambil metadata statistik dokumen untuk pertanyaan agregat
  const { data: allDocs } = await supabase
    .from("documents")
    .select("title, category, classification, retention_date, created_at, is_scanned")
    .in("classification", allowedClassifications)
    .eq("status", "ready");

  const metaContext = `
RINGKASAN ARSIP CLARA:
- Total dokumen yang bisa Anda akses: ${allDocs?.length || 0}
- Dokumen per kategori: ${JSON.stringify(
    (allDocs || []).reduce((acc: Record<string, number>, d: { category: string }) => {
      acc[d.category] = (acc[d.category] || 0) + 1; return acc;
    }, {})
  )}
- Dokumen scan (analisis terbatas): ${(allDocs || []).filter((d: { is_scanned: boolean }) => d.is_scanned).length}
- Dokumen akan expired bulan ini: ${(allDocs || []).filter((d: { retention_date: string | null }) => {
    if (!d.retention_date) return false;
    const exp = new Date(d.retention_date);
    const now = new Date();
    const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length}`;

  // 3. Build system prompt
  const systemPrompt = `Kamu adalah CLARA AI Assistant — asisten untuk sistem manajemen dokumen arsip organisasi Arranetwork.

PERANMU:
- Menjawab pertanyaan tentang dokumen yang tersimpan di arsip CLARA
- Membantu user menemukan, memahami, dan menganalisis dokumen
- Hanya berbicara tentang dokumen dalam sistem CLARA — tidak menjawab pertanyaan umum di luar konteks ini

BATASAN:
- Hanya akses dokumen dengan klasifikasi: ${allowedClassifications.join(", ")}
- Jangan membuat informasi yang tidak ada dalam konteks dokumen
- Jika tidak ada dokumen relevan, katakan dengan jelas
- Jawab dalam Bahasa Indonesia yang profesional dan ringkas

${metaContext}

${documentContext ? `DOKUMEN RELEVAN DITEMUKAN:\n${documentContext}` : "Tidak ada dokumen yang secara spesifik relevan dengan pertanyaan ini, tapi kamu bisa menjawab berdasarkan metadata arsip di atas."}`;

  // 4. Build messages dengan history
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-6).map((h: { role: string; content: string }) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user" as const, content: question },
  ];

  // 5. Call OpenAI
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.3,
    max_tokens: 800,
  });

  const answer = response.choices[0].message.content || "Maaf, tidak dapat memproses pertanyaan ini.";

  // 6. Log ke audit trail
  await supabase.from("search_history").insert({
    user_id: user.id,
    query: `[AI] ${question}`,
    result_count: 1,
  });

  return NextResponse.json({ answer, hasContext: !!documentContext });
}
