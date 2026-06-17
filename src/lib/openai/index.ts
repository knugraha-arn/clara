import OpenAI from "openai";
import type { AiAnalysisResult, DocumentCategory, DocumentClassification } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeDocumentPage1(
  extractedText: string,
  fileName: string
): Promise<AiAnalysisResult> {
  const prompt = `Kamu adalah sistem analisis dokumen untuk organisasi Indonesia.
Analisis dokumen PDF berikut dan berikan hasil dalam JSON.

NAMA FILE: ${fileName}
KONTEN DOKUMEN:
---
${extractedText.slice(0, 3000)}
---

Berikan HANYA JSON berikut tanpa penjelasan lain:
{
  "summary": "Ringkasan 2-3 kalimat bahasa Indonesia",
  "category": "surat_masuk | surat_keluar | kontrak | memo | laporan | kebijakan | undangan | pengumuman | lainnya",
  "category_confidence": 0.0,
  "classification": "public | internal | confidential | restricted",
  "classification_confidence": 0.0,
  "classification_reason": "Alasan singkat klasifikasi dalam 1 kalimat",
  "tags": ["keyword1", "keyword2", "keyword3"],
  "document_date": "YYYY-MM-DD atau null",
  "sender": "nama pengirim atau null",
  "recipient": "nama penerima atau null"
}

Panduan klasifikasi:
- public: informasi umum, tidak sensitif, boleh diketahui publik
- internal: untuk karyawan saja, memo, SOP, laporan operasional
- confidential: kontrak, data keuangan, data pelanggan, perjanjian bisnis
- restricted: NDA, data akuisisi, rahasia dagang, informasi board level`;

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
    if (!validCategories.includes(parsed.category)) parsed.category = "lainnya";

    const validClassifications: DocumentClassification[] = ["public", "internal", "confidential", "restricted"];
    if (!validClassifications.includes(parsed.classification)) parsed.classification = "internal";

    return parsed;
  } catch (error) {
    console.error("[OpenAI] analyzeDocumentPage1 error:", error);
    return {
      summary: "Gagal menganalisis dokumen secara otomatis.",
      category: "lainnya",
      category_confidence: 0,
      classification: "internal",
      classification_confidence: 0,
      classification_reason: "Default klasifikasi",
      tags: [],
      document_date: null,
      sender: null,
      recipient: null,
    };
  }
}

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
