import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedSearchQuery } from "@/lib/openai";
import OpenAI from "openai";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DAILY_LIMITS: Record<string, number> = {
  viewer:      10, // boleh akses tapi terbatas
  auditor:     20,
  contributor: 30,
  admin:       50,
  super_admin: 999999,
};

const CAT_LABELS: Record<string, string> = {
  surat_masuk: "Surat Masuk", surat_keluar: "Surat Keluar", kontrak: "Kontrak",
  memo: "Memo", laporan: "Laporan", kebijakan: "Kebijakan",
  undangan: "Undangan", pengumuman: "Pengumuman", lainnya: "Lainnya",
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
  const userRole = profile?.role || "viewer";
  const limit = DAILY_LIMITS[userRole] ?? 0;
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

  // ============================================================
  // 1. AMBIL SEMUA DOKUMEN LENGKAP
  // ============================================================
  type DocType = {
    id: string; title: string; file_name: string; category: string; classification: string;
    summary: string | null; tags: string[]; retention_date: string | null;
    created_at: string; is_scanned: boolean; user_id: string; page_count: number | null; file_size: number;
  };

  const { data: allDocsRaw } = await supabase
    .from("documents")
    .select("id, title, file_name, category, classification, summary, tags, retention_date, created_at, is_scanned, user_id, page_count, file_size")
    .in("classification", allowedClassifications)
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  const allDocs = (allDocsRaw || []) as DocType[];

  // Ambil nama uploader
  const userIds = [...new Set(allDocs.map(d => d.user_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
  const profileMap = Object.fromEntries((profiles || []).map((p: { id: string; full_name: string; email: string }) => [p.id, p.full_name || p.email]));

  // Ambil semua parties per dokumen
  const { data: allDocParties } = await supabase
    .from("document_parties")
    .select("document_id, parties(name)")
    .in("document_id", allDocs.map(d => d.id));

  type DocPartyRow = { document_id: string; parties: { name: string } | { name: string }[] | null };
  const partyMap: Record<string, string[]> = {};
  (allDocParties || []).forEach((dp: DocPartyRow) => {
    const name = Array.isArray(dp.parties) ? dp.parties[0]?.name : dp.parties?.name;
    if (name) {
      if (!partyMap[dp.document_id]) partyMap[dp.document_id] = [];
      partyMap[dp.document_id].push(name);
    }
  });

  // ============================================================
  // 2. AMBIL SEMUA NOMOR SURAT
  // ============================================================
  const { data: allNumbers } = await supabase
    .from("document_numbers")
    .select("number, party_name, category, classification, description, status, date, created_by_name, document_id")
    .order("date", { ascending: false });

  // ============================================================
  // 3. STATISTIK
  // ============================================================
  const totalDocs = allDocs.length;

  const byClassification = allDocs.reduce((acc: Record<string, number>, d) => {
    acc[d.classification] = (acc[d.classification] || 0) + 1; return acc;
  }, {});

  const byCategory = allDocs.reduce((acc: Record<string, number>, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1; return acc;
  }, {});

  const totalSizeMB = (allDocs.reduce((sum, d) => sum + (d.file_size || 0), 0) / (1024 * 1024)).toFixed(1);

  const expiringDocs = allDocs.filter(d => {
    if (!d.retention_date) return false;
    const diff = (new Date(d.retention_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  const expiredDocs = allDocs.filter(d => {
    if (!d.retention_date) return false;
    return new Date(d.retention_date) < new Date();
  });

  // ============================================================
  // 4. SEMANTIC SEARCH untuk konteks relevan
  // ============================================================
  let semanticContext = "";
  try {
    const queryEmbedding = await embedSearchQuery(question);
    const { data: semanticResults } = await supabase.rpc("search_documents_semantic_all", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.25,
      match_count: 5,
    });

    if (semanticResults?.length > 0) {
      const docIds = [...new Set(semanticResults.map((r: { document_id: string }) => r.document_id))];
      const relevantDocs = allDocs.filter(d => docIds.includes(d.id));

      if (relevantDocs.length > 0) {
        semanticContext = "DOKUMEN PALING RELEVAN (semantic search):\n" + relevantDocs.map(d => {
          const parties = partyMap[d.id]?.join(", ") || "tidak ada";
          const uploader = profileMap[d.user_id] || "Unknown";
          const chunk = semanticResults.find((r: { document_id: string; chunk_text: string }) => r.document_id === d.id);
          return `- "${d.title}" | ${CAT_LABELS[d.category] || d.category} | ${d.classification} | Pihak: ${parties} | Upload: ${uploader} | ${d.summary?.slice(0, 100) || ""}\n  Konten: ${chunk?.chunk_text?.slice(0, 200) || ""}`;
        }).join("\n");
      }
    }
  } catch (e) {
    console.error("[AI] Semantic error:", e);
  }

  // ============================================================
  // 5. PARTY CONTEXT
  // ============================================================
  let partyContext = "";
  try {
    const { data: matchingParties } = await supabase
      .from("parties")
      .select("id, name")
      .ilike("name", `%${question.slice(0, 50)}%`)
      .limit(5);

    if (matchingParties && matchingParties.length > 0) {
      for (const party of matchingParties) {
        const docsWithParty = allDocs.filter(d => partyMap[d.id]?.includes(party.name));
        if (docsWithParty.length > 0) {
          partyContext += `\nDOKUMEN YANG MELIBATKAN "${party.name}":\n`;
          partyContext += docsWithParty.map(d => {
            const uploader = profileMap[d.user_id] || "Unknown";
            return `  - "${d.title}" (${CAT_LABELS[d.category] || d.category}, ${d.classification}, ${new Date(d.created_at).toLocaleDateString("id-ID")}, oleh: ${uploader}${d.summary ? ", ringkasan: " + d.summary.slice(0, 80) : ""})`;
          }).join("\n");
        }
      }
    }
  } catch (e) {
    console.error("[AI] Party error:", e);
  }

  // ============================================================
  // 6. BUILD FULL CONTEXT
  // ============================================================

  // List dokumen lengkap (max 50 untuk hemat token)
  const docListContext = allDocs.slice(0, 50).map(d => {
    const parties = partyMap[d.id]?.join(", ") || "-";
    const uploader = profileMap[d.user_id] || "Unknown";
    const retention = d.retention_date ? new Date(d.retention_date).toLocaleDateString("id-ID") : "-";
    return `• "${d.title}" | ${CAT_LABELS[d.category] || d.category} | ${d.classification} | Pihak: ${parties} | Uploader: ${uploader} | Retensi: ${retention} | Summary: ${d.summary?.slice(0, 80) || "-"}`;
  }).join("\n");

  // Nomor surat context
  const numberContext = (allNumbers || []).slice(0, 30).map((n: {
    number: string; party_name: string; category: string; classification: string;
    description: string; status: string; date: string; created_by_name: string; document_id: string | null;
  }) =>
    `• ${n.number} | ${CAT_LABELS[n.category] || n.category} | ${n.classification} | Pihak: ${n.party_name} | Perihal: ${n.description} | Status: ${n.status} | Tanggal: ${new Date(n.date).toLocaleDateString("id-ID")} | Oleh: ${n.created_by_name} | Dokumen: ${n.document_id ? "✅ Terlampir" : "❌ Belum ada"}`
  ).join("\n");

  const metaContext = `
STATISTIK ARSIP CLARA (data real-time, akurat):
- Total dokumen: ${totalDocs}
- Total storage: ${totalSizeMB} MB
- Dokumen scan: ${allDocs.filter(d => d.is_scanned).length}
- Per klasifikasi:
  * Public: ${byClassification["public"] || 0}
  * Internal: ${byClassification["internal"] || 0}
  * Confidential: ${byClassification["confidential"] || 0}
  * Restricted: ${byClassification["restricted"] || 0}
- Per kategori: ${Object.entries(byCategory).map(([k, v]) => `${CAT_LABELS[k] || k}: ${v}`).join(", ")}
- Akan expired (30 hari): ${expiringDocs.length}${expiringDocs.length > 0 ? " — " + expiringDocs.map(d => d.title).join(", ") : ""}
- Sudah expired: ${expiredDocs.length}
- Total nomor surat: ${allNumbers?.length || 0}
- Nomor surat Issued (belum ada dokumen): ${(allNumbers || []).filter((n: { status: string; document_id: string | null }) => n.status === "issued" && !n.document_id).length}

DAFTAR LENGKAP DOKUMEN:
${docListContext || "Tidak ada dokumen"}

DAFTAR NOMOR SURAT:
${numberContext || "Tidak ada nomor surat"}`;

  // ============================================================
  // 7. SYSTEM PROMPT
  // ============================================================
  const systemPrompt = `Kamu adalah CLARA AI Assistant — asisten manajemen dokumen arsip untuk Arranetwork.

IDENTITAS:
- Jawab selalu dalam Bahasa Indonesia yang profesional dan ringkas
- Kamu memiliki akses penuh ke semua data arsip CLARA di bawah

YANG BISA KAMU LAKUKAN ✅:
- Menjawab pertanyaan tentang dokumen, nomor surat, party, statistik arsip
- Memberikan info detail: siapa upload, kapan, pihak yang terlibat, klasifikasi, ringkasan
- Query berdasarkan party, kategori, klasifikasi, status retensi
- Analisis dan rekomendasi berdasarkan data arsip

YANG TIDAK BISA ❌:
- Menjawab di luar konteks arsip CLARA
- Generate kode atau artefak
- Mengakses data di luar yang diberikan di bawah

AKSES USER: Klasifikasi yang bisa diakses: ${allowedClassifications.join(", ")}

${metaContext}

${semanticContext ? "\n" + semanticContext : ""}
${partyContext ? "\n" + partyContext : ""}

INSTRUKSI KRITIS:
1. Gunakan HANYA data di atas untuk menjawab — data ini akurat dan real-time
2. Untuk pertanyaan statistik (berapa, jumlah, total) — jawab LANGSUNG dari angka di STATISTIK ARSIP
3. Untuk pertanyaan tentang dokumen spesifik — cari di DAFTAR LENGKAP DOKUMEN
4. Untuk pertanyaan tentang nomor surat — cari di DAFTAR NOMOR SURAT
5. Jangan pernah bilang "tidak ada" jika data menunjukkan ada
6. Sebutkan nama dokumen/nomor secara eksplisit jika relevan
7. Jawaban maksimal 4 paragraf, langsung ke poin`;

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
    temperature: 0.1,
    max_tokens: 800,
  });

  const answer = response.choices[0].message.content || "Maaf, tidak dapat memproses pertanyaan ini.";

  await supabase.from("search_history").insert({
    user_id: user.id,
    query: "[AI] " + question,
    result_count: allDocs.length,
  });

  return NextResponse.json({
    answer,
    hasContext: true,
    docsFound: allDocs.length,
    usage: { used: used + 1, limit, remaining: isUnlimited ? 999999 : Math.max(0, limit - used - 1), isUnlimited },
  });
}
