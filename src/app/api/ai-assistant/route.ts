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

// GET — cek usage hari ini
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role || "auditor";
  const limit = DAILY_LIMITS[role] || 20;
  const isUnlimited = role === "super_admin";

  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("ai_usage").select("count").eq("user_id", user.id).eq("usage_date", today).single();

  const used = usage?.count || 0;
  return NextResponse.json({ used, limit, remaining: isUnlimited ? 999999 : Math.max(0, limit - used), isUnlimited });
}

// POST — kirim pertanyaan
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const userRole = profile?.role || "auditor";
  const limit = DAILY_LIMITS[userRole] || 20;
  const isUnlimited = userRole === "super_admin";

  // Cek usage
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("ai_usage").select("count").eq("user_id", user.id).eq("usage_date", today).single();

  const used = usage?.count || 0;
  if (!isUnlimited && used >= limit) {
    return NextResponse.json({
      error: `Batas harian tercapai (${limit} pertanyaan). Reset besok pukul 00:00.`,
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

  // 1. Semantic search — ambil dokumen relevan
  let documentContext = "";
  let foundDocs: { title: string; category: string; classification: string }[] = [];

  try {
    const queryEmbedding = await embedSearchQuery(question);
    const { data: semanticResults } = await supabase.rpc("search_documents_semantic_all", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.25, // lebih rendah untuk tangkap lebih banyak
      match_count: 10,
    });

    if (semanticResults?.length > 0) {
      const docIds = [...new Set(semanticResults.map((r: { document_id: string }) => r.document_id))];
      const { data: docs } = await supabase
        .from("documents")
        .select("id, title, summary, category, classification, retention_date, created_at, tags, file_name")
        .in("id", docIds)
        .in("classification", allowedClassifications)
        .eq("status", "ready");

      if (docs && docs.length > 0) {
        foundDocs = docs;
        type DocType = { id: string; title: string; summary: string | null; category: string; classification: string; retention_date: string | null; created_at: string; tags: string[]; file_name: string };
        const docMap = Object.fromEntries(docs.map((d: DocType) => [d.id, d]));

        const relevantChunks = semanticResults
          .filter((r: { document_id: string }) => docMap[r.document_id])
          .slice(0, 6);

        documentContext = relevantChunks.map((r: { document_id: string; chunk_text: string; similarity: number }) => {
          const doc = docMap[r.document_id] as DocType;
          if (!doc) return "";
          return `[DOKUMEN: "${doc.title}"]
- Nama file: ${doc.file_name}
- Kategori: ${doc.category} | Klasifikasi: ${doc.classification}
- Retensi: ${doc.retention_date ? new Date(doc.retention_date).toLocaleDateString("id-ID") : "tidak diset"}
- Ringkasan: ${doc.summary || "tidak ada ringkasan"}
- Tags: ${doc.tags?.join(", ") || "-"}
- Konten relevan: ${r.chunk_text.slice(0, 400)}
- Similarity score: ${Math.round(r.similarity * 100)}%`;
        }).filter(Boolean).join("\n\n---\n\n");
      }
    }
  } catch (e) {
    console.error("[AI] Semantic search error:", e);
  }

  // 2. Juga cari exact match berdasarkan keyword dari pertanyaan
  let exactContext = "";
  try {
    const { data: exactDocs } = await supabase
      .from("documents")
      .select("id, title, summary, category, classification, retention_date, created_at, tags")
      .in("classification", allowedClassifications)
      .eq("status", "ready")
      .or(`title.ilike.%${question.slice(0, 50)}%,summary.ilike.%${question.slice(0, 50)}%`)
      .limit(3);

    if (exactDocs && exactDocs.length > 0) {
      const newDocs = (exactDocs as { id: string; title: string; category: string; classification: string; retention_date: string | null; summary: string | null }[]).filter(d => !foundDocs.find(f => f.title === d.title));
      if (newDocs.length > 0) {
        exactContext = "\n\nDOKUMEN DITEMUKAN VIA KEYWORD:\n" + newDocs.map((d: {
          title: string; category: string; classification: string; retention_date: string | null; summary: string | null;
        }) => `[${d.title}] — ${d.category} | ${d.classification} | Retensi: ${d.retention_date ? new Date(d.retention_date).toLocaleDateString("id-ID") : "tidak diset"} | ${d.summary || ""}`).join("\n");
      }
    }
  } catch (e) {
    console.error("[AI] Exact search error:", e);
  }

  // 3. Metadata real-time
  type AllDocType = { id: string; title: string; category: string; classification: string; retention_date: string | null; created_at: string; is_scanned: boolean; tags: string[] };
  const { data: allDocsRaw } = await supabase
    .from("documents")
    .select("id, title, category, classification, retention_date, created_at, is_scanned, tags")
    .in("classification", allowedClassifications)
    .eq("status", "ready");
  const allDocs = (allDocsRaw || []) as AllDocType[];

  const totalDocs = allDocs.length;
  const byCategory = allDocs.reduce((acc: Record<string, number>, d: AllDocType) => {
    acc[d.category] = (acc[d.category] || 0) + 1; return acc;
  }, {});
  const expiringDocs = allDocs.filter((d: AllDocType) => {
    if (!d.retention_date) return false;
    const diff = (new Date(d.retention_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  const metaContext = `DATA ARSIP CLARA (real-time):
- Total dokumen tersedia: ${totalDocs}
- Per kategori: ${JSON.stringify(byCategory)}
- Dokumen akan expired dalam 30 hari: ${expiringDocs.length}${expiringDocs.length > 0 ? " (" + expiringDocs.slice(0, 3).map((d: AllDocType) => d.title).join(", ") + ")" : ""}
- Dokumen scan: ${allDocs.filter((d: AllDocType) => d.is_scanned).length}`;

  const systemPrompt = `Kamu adalah CLARA AI Assistant — asisten manajemen dokumen arsip untuk organisasi Arranetwork Indonesia.

IDENTITAS & PERAN:
- Kamu membantu user menemukan, memahami, dan menganalisis dokumen di arsip CLARA
- Selalu jawab dalam Bahasa Indonesia yang profesional dan ringkas
- Jika menemukan dokumen relevan, sebutkan nama dokumennya secara spesifik

YANG BISA KAMU LAKUKAN ✅:
- Menjawab pertanyaan tentang dokumen di arsip CLARA
- Memberikan info metadata (kategori, klasifikasi, tanggal, retensi)
- Statistik dan rangkuman arsip
- Rekomendasi tindakan (expired, perlu review, dll)
- Pencarian dan analisis isi dokumen

YANG TIDAK BISA ❌:
- Menjawab di luar konteks arsip CLARA
- Generate kode atau artefak
- Mengakses internet atau data eksternal
- Menampilkan isi verbatim dokumen Confidential/Restricted

AKSES: Klasifikasi yang bisa diakses user ini: ${allowedClassifications.join(", ")}

${metaContext}

${documentContext ? `DOKUMEN RELEVAN DITEMUKAN (berdasarkan semantic search):\n${documentContext}` : "Tidak ada dokumen yang spesifik relevan berdasarkan semantic search."}
${exactContext}

INSTRUKSI PENTING:
- Jika ada dokumen relevan di atas, sebutkan nama dokumennya secara eksplisit dalam jawaban
- Jika tidak ada dokumen yang relevan, katakan dengan jujur dan sarankan user untuk mencoba kata kunci berbeda
- Untuk pertanyaan tentang expired/retensi, gunakan data di atas
- Jawaban singkat dan to the point, maksimal 3-4 paragraf`;

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
    temperature: 0.2,
    max_tokens: 600,
  });

  const answer = response.choices[0].message.content || "Maaf, tidak dapat memproses pertanyaan ini.";

  await supabase.from("search_history").insert({
    user_id: user.id,
    query: "[AI] " + question,
    result_count: foundDocs.length,
  });

  return NextResponse.json({
    answer,
    hasContext: !!documentContext || !!exactContext,
    docsFound: foundDocs.length,
    usage: { used: used + 1, limit, remaining: isUnlimited ? 999999 : Math.max(0, limit - used - 1), isUnlimited },
  });
}
