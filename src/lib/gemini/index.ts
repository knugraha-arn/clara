import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiAnalysisResult, DocumentCategory } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Model untuk text generation (murah & cepat)
const flashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Model untuk embedding
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// ============================================
// Analisis halaman 1 dokumen PDF
// Menghasilkan: summary, kategori, tags, metadata
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
  "category_confidence": 0.0 sampai 1.0,
  "tags": ["array", "of", "relevant", "keywords", "max 5"],
  "document_date": "YYYY-MM-DD atau null jika tidak ada",
  "sender": "nama pengirim/instansi atau null",
  "recipient": "nama penerima/instansi atau null"
}`;

  try {
    const result = await flashModel.generateContent(prompt);
    const text = result.response.text();

    // Strip markdown code blocks jika ada
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned) as AiAnalysisResult;

    // Validasi category
    const validCategories: DocumentCategory[] = [
      "surat_masuk", "surat_keluar", "kontrak", "memo",
      "laporan", "kebijakan", "undangan", "pengumuman", "lainnya"
    ];
    if (!validCategories.includes(parsed.category)) {
      parsed.category = "lainnya";
    }

    return parsed;
  } catch (error) {
    console.error("[Gemini] analyzeDocumentPage1 error:", error);
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
// Generate embedding untuk semantic search
// ============================================
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

// ============================================
// Chunk text untuk embedding pipeline
// 500 kata per chunk, overlap 50 kata
// ============================================
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

// ============================================
// Semantic search query → vector
// ============================================
export async function embedSearchQuery(query: string): Promise<number[]> {
  return generateEmbedding(query);
}
