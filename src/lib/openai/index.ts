import OpenAI from "openai";
import type { AiAnalysisResult, DocumentCategory, DocumentClassification } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ANALYSIS_INSTRUCTIONS = `Berikan HANYA JSON berikut tanpa penjelasan lain:
{
  "summary": "Ringkasan 2-3 kalimat bahasa Indonesia",
  "category": "surat_masuk | surat_keluar | kontrak | nda | memo | prosedur | kebijakan | instruksi_kerja | template | laporan | undangan | pengumuman | invoice | po | berita_acara | lainnya",
  "category_confidence": 0.0,
  "classification": "public | internal | confidential | restricted",
  "classification_confidence": 0.0,
  "classification_reason": "Alasan singkat klasifikasi dalam 1 kalimat",
  "tags": ["keyword1", "keyword2", "keyword3"],
  "document_date": "YYYY-MM-DD atau null",
  "sender": "nama pengirim atau null",
  "recipient": "nama penerima atau null",
  "suggested_valid_until": "YYYY-MM-DD atau null",
  "compliance_flags": ["string", "..."]
}

Panduan kategori:
- surat_masuk: surat yang diterima dari pihak luar
- surat_keluar: surat yang dikirim ke pihak luar
- kontrak: perjanjian kerja sama, kontrak bisnis
- nda: non-disclosure agreement, perjanjian kerahasiaan
- memo: memo internal, nota dinas
- prosedur: SOP, prosedur kerja, standard operating procedure
- kebijakan: kebijakan perusahaan, policy
- instruksi_kerja: work instruction, panduan teknis
- template: template dokumen, format baku
- laporan: laporan kerja, laporan keuangan, laporan proyek
- undangan: undangan rapat, undangan acara
- pengumuman: pengumuman internal/eksternal
- invoice: tagihan, faktur, invoice pembayaran
- po: purchase order, surat pesanan pembelian
- berita_acara: berita acara serah terima, berita acara rapat
- lainnya: tidak termasuk kategori di atas

Panduan klasifikasi:
- public: informasi umum, tidak sensitif, boleh diketahui publik
- internal: untuk karyawan saja, memo, SOP, laporan operasional
- confidential: kontrak, data keuangan, data pelanggan, perjanjian bisnis
- restricted: NDA, data akuisisi, rahasia dagang, informasi board level, invoice, purchase order, berita acara

PENTING: Dokumen dengan kategori invoice, po, atau berita_acara HARUS diklasifikasikan sebagai restricted kecuali ada alasan kuat sebaliknya.

Panduan "suggested_valid_until":
- ISI HANYA kalau dokumen secara EKSPLISIT menyebut tanggal/jangka waktu berakhir/berlaku (contoh: "berlaku sampai dengan 31 Desember 2027", "masa kontrak 2 tahun terhitung dari 1 Januari 2026", "jatuh tempo 30 hari setelah invoice diterbitkan" — hitung tanggal pastinya dari document_date kalau perlu)
- Kalau dokumen TIDAK menyebut tanggal/jangka waktu berakhir secara eksplisit, isi null — JANGAN menebak atau memberi tanggal default

Panduan "compliance_flags" (array string singkat, kosongkan [] kalau tidak ada temuan):
- Untuk kontrak/NDA: flag kalau tidak terlihat ada halaman/blok tanda tangan kedua pihak, atau tidak ada tanggal mulai/berakhir yang jelas
- Untuk invoice/PO: flag kalau tidak ada nominal total yang jelas, atau tidak ada nomor referensi/invoice
- Untuk berita_acara: flag kalau tidak ada tanda tangan pihak yang terlibat
- Jangan memberi flag yang mengada-ada — kalau dokumen terlihat lengkap dan wajar, biarkan array kosong
- Setiap flag maksimal 1 kalimat singkat, bahasa Indonesia, langsung ke poin (contoh: "Tidak ditemukan blok tanda tangan di akhir dokumen")`;

function fallbackResult(): AiAnalysisResult {
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
    suggested_valid_until: null,
    compliance_flags: [],
  };
}

function parseAnalysisResponse(text: string): AiAnalysisResult {
  const parsed = JSON.parse(text) as AiAnalysisResult;

  const validCategories: DocumentCategory[] = [
    "surat_masuk", "surat_keluar", "kontrak", "nda", "memo",
    "prosedur", "kebijakan", "instruksi_kerja", "template",
    "laporan", "undangan", "pengumuman", "invoice", "po", "berita_acara", "lainnya"
  ];
  if (!validCategories.includes(parsed.category)) parsed.category = "lainnya";

  const validClassifications: DocumentClassification[] = ["public", "internal", "confidential", "restricted"];
  if (!validClassifications.includes(parsed.classification)) parsed.classification = "internal";

  // Validasi ringan — kalau model ngasih format aneh, jangan sampai patah di caller
  if (typeof parsed.suggested_valid_until !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.suggested_valid_until)) {
    parsed.suggested_valid_until = null;
  }
  if (!Array.isArray(parsed.compliance_flags)) {
    parsed.compliance_flags = [];
  } else {
    parsed.compliance_flags = parsed.compliance_flags.filter(f => typeof f === "string" && f.trim().length > 0).slice(0, 6);
  }

  return parsed;
}

export async function analyzeDocumentPreview(
  extractedText: string,
  fileName: string
): Promise<AiAnalysisResult> {
  const prompt = `Kamu adalah sistem analisis dokumen untuk organisasi Indonesia.
Analisis dokumen PDF berikut dan berikan hasil dalam JSON.

NAMA FILE: ${fileName}
KONTEN DOKUMEN:
---
${extractedText.slice(0, 7000)}
---

${ANALYSIS_INSTRUCTIONS}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    return parseAnalysisResponse(response.choices[0].message.content || "{}");
  } catch (error) {
    console.error("[OpenAI] analyzeDocumentPreview error:", error);
    return fallbackResult();
  }
}

// Untuk dokumen hasil scan (tidak ada teks yang bisa diekstrak) — kirim PDF
// langsung ke model vision-capable, yang membaca gambar tiap halaman.
// PDF dibatasi ~2 halaman pertama secara implisit oleh caller (lihat process/route.ts)
// supaya biaya token tetap terkendali dan konsisten dengan analisis dokumen biasa.
export async function analyzeScannedDocument(
  pdfBase64: string,
  fileName: string
): Promise<AiAnalysisResult> {
  const prompt = `Kamu adalah sistem analisis dokumen untuk organisasi Indonesia.
Dokumen PDF ini adalah hasil SCAN (gambar) — baca isinya langsung dari gambar halaman yang diberikan.

NAMA FILE: ${fileName}

${ANALYSIS_INSTRUCTIONS}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "file",
              file: {
                filename: fileName,
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    return parseAnalysisResponse(response.choices[0].message.content || "{}");
  } catch (error) {
    console.error("[OpenAI] analyzeScannedDocument error:", error);
    return fallbackResult();
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
