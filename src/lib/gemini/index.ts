import OpenAI from "openai";
import type { AiAnalysisResult, DocumentCategory } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================
// Analisis dokumen halaman 1
// ============================================
export async function analyzeDocumentPage1(
  extractedText: string,
  fileName: string
): Promise<AiAnalysisResult> {
  const prompt = `Kamu adalah sistem analisis dokumen untuk sebuah organisasi Indonesia.
Analisis teks berikut yang diambil dari halaman pertama sebuah dokumen PDF.

NAMA FILE: ${fileName}
TEKS HALAMAN 1:
---
${extractedText.slice(0, 3000)}
---

Berikan analisis dalam format JSON berikut (HANYA JSON, tanpa penjelasan lain):
{
  "summary": "Ringkasan singkat isi dokumen dalam 2-3 kalimat bahasa Indonesia",
  "category": "salah satu dari: surat_masuk | surat_keluar | kontrak | memo | laporan | kebijakan | undangan | pengumuman | lainnya",
  "category_confidence": 0.0,
  "tags": ["keyword1", "keyword2"],
  "document_date": null,
  "sender": null,
  "recipient": null
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(text) as AiAnalysisResult;

    const validCategories: DocumentCategory[] = [
      "surat_masuk", "surat_keluar", "kontrak", "memo",
      "laporan", "kebijakan", "undangan", "pengumuman", "lainnya"
    ];
    if (!validCategories.includes(parsed.category)) {
      parsed.category = "lainnya";
    }
    return parsed;
  } catch (error) {
    console.error("[OpenAI] analyzeDocumentPage1 error:", error);
    return {
      summary: "Gagal menganalisis dokumen secara otomatis.",
      category: "lainnya",
      category_confidence: 0,
      tags: [],
      document_date: null,
      sender: null,
      recipient: null,
    };
  }
}

// ============================================
// Generate embedding (dimension: 1536)
// ============================================
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("[OpenAI] generateEmbedding error:", error);
    return [];
  }
}

export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.length > 10) chunks.push(chunk);
    if (i + chunkSize >= words.length) break;
  }
  return chunks;
}

export async function embedSearchQuery(query: string): Promise<number[]> {
  return generateEmbedding(query);
}
