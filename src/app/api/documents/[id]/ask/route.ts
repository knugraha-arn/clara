import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";
import OpenAI from "openai";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DAILY_LIMITS: Record<string, number> = {
  viewer: 10, auditor: 20, contributor: 30, admin: 50, super_admin: 999999,
};

function allowedClassifications(role: string): string[] {
  if (["admin", "super_admin"].includes(role)) return ["public", "internal", "confidential", "restricted"];
  if (["contributor", "auditor"].includes(role)) return ["public", "internal", "confidential"];
  return ["public", "internal"];
}

// POST — tanya soal 1 dokumen spesifik. Pakai kuota harian yang SAMA dengan
// /api/ai-assistant (satu pool biaya AI, bukan kuota terpisah).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const role = profile?.role || "viewer";
  const limit = DAILY_LIMITS[role] ?? 0;
  const isUnlimited = role === "super_admin";

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

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, category, classification, summary, tags, document_date, sender, recipient, valid_until, retention_date, is_scanned, page_count, user_id")
    .eq("id", documentId)
    .eq("status", "ready")
    .single();

  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  if (!allowedClassifications(role).includes(doc.classification)) {
    return NextResponse.json({ error: "Kamu tidak punya akses ke dokumen ini" }, { status: 403 });
  }

  // Increment usage (pool yang sama dengan AI Assistant global)
  if (usage) {
    await supabase.from("ai_usage").update({ count: used + 1, updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("usage_date", today);
  } else {
    await supabase.from("ai_usage").insert({ user_id: user.id, usage_date: today, count: 1 });
  }

  const adminSupabase = await createAdminClient();

  // Rekonstruksi isi dokumen dari chunk embedding (lebih lengkap daripada cuma preview)
  const { data: chunks } = await adminSupabase
    .from("document_embeddings")
    .select("chunk_text, chunk_index")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });

  const fullText = (chunks || []).map(c => c.chunk_text).join("\n\n");
  const contentForAi = fullText.trim().length > 0 ? fullText : (doc.summary || "");
  const contentIsLimited = doc.is_scanned && fullText.trim().length < 500;

  // Pihak terkait
  const { data: docParties } = await supabase
    .from("document_parties")
    .select("parties(name)")
    .eq("document_id", documentId);
  const partyNames = (docParties || [])
    .map((dp: { parties: { name: string } | { name: string }[] | null }) => Array.isArray(dp.parties) ? dp.parties[0]?.name : dp.parties?.name)
    .filter(Boolean)
    .join(", ");

  const systemPrompt = `Kamu adalah asisten yang menjawab pertanyaan HANYA tentang SATU dokumen berikut. Jangan menjawab di luar isi dokumen ini, dan jangan mengakses atau menyebut dokumen lain.

INFO DOKUMEN:
- Judul: "${doc.title}"
- Kategori: ${doc.category}
- Klasifikasi: ${doc.classification}
- Pihak terkait: ${partyNames || "tidak tercatat"}
- Tanggal dokumen: ${doc.document_date || "tidak tercatat"}
- Pengirim: ${doc.sender || "-"} | Penerima: ${doc.recipient || "-"}
- Masa berlaku: ${doc.valid_until || "tidak ada"}
- Ringkasan: ${doc.summary || "-"}

ISI DOKUMEN:
---
${contentForAi.slice(0, 12000) || "(tidak ada teks tersedia)"}
---
${contentIsLimited ? "\nCATATAN PENTING: Dokumen ini hasil scan dan isi lengkapnya tidak tersedia — yang kamu punya cuma ringkasan AI singkat di atas. Kalau pertanyaan butuh detail yang tidak ada di ringkasan, katakan dengan jujur bahwa kamu tidak punya akses ke isi lengkap dokumen scan ini." : ""}

INSTRUKSI:
1. Jawab dalam Bahasa Indonesia, ringkas dan langsung ke poin (maksimal 3 paragraf)
2. Kalau pertanyaan tidak bisa dijawab dari info/isi dokumen di atas, katakan dengan jujur bahwa informasi itu tidak ada di dokumen ini — jangan mengarang
3. Jangan asumsikan hal yang tidak disebutkan eksplisit di dokumen`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-6).map((h: { role: string; content: string }) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: question },
  ];

  let answer: string;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.1,
      max_tokens: 500,
    });
    answer = response.choices[0].message.content || "Maaf, tidak dapat memproses pertanyaan ini.";
  } catch (error) {
    console.error("[DocumentAsk] OpenAI error:", error);
    return NextResponse.json({ error: "Gagal mendapat jawaban dari AI. Coba lagi." }, { status: 500 });
  }

  // Audit — AI membaca & menjawab dari dokumen sensitif (ISO 27001 A.8.16)
  if (["confidential", "restricted"].includes(doc.classification)) {
    await logEvent({
      supabase: adminSupabase,
      documentId: doc.id,
      documentTitle: doc.title,
      userId: user.id,
      userEmail: user.email || "",
      userName: profile?.full_name || undefined,
      eventType: "viewed",
      metadata: { via: "document_ask", question: question.slice(0, 200) },
      request,
    });
  }

  return NextResponse.json({
    answer,
    usage: { used: used + 1, limit, remaining: isUnlimited ? 999999 : Math.max(0, limit - used - 1), isUnlimited },
  });
}
