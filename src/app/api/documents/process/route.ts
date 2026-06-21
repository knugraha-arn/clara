import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { analyzeDocumentPreview, analyzeScannedDocument, generateEmbedding, chunkText } from "@/lib/openai";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = await createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!["contributor", "admin", "super_admin"].includes(profile?.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { storagePath, fileName, fileSize, title, classificationOverride, overrideReason } = await request.json();
    if (!storagePath) return NextResponse.json({ error: "storagePath diperlukan" }, { status: 400 });

    // 1. Create document record
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        title: title || fileName.replace(".pdf", ""),
        file_name: fileName,
        file_path: storagePath,
        file_size: fileSize,
        mime_type: "application/pdf",
        status: "processing",
      })
      .select()
      .single();

    if (docError || !doc) {
      console.error("[Process] DB insert error:", docError);
      return NextResponse.json({ error: "Gagal menyimpan dokumen" }, { status: 500 });
    }

    // 2. Download dari storage
    const { data: fileData, error: downloadError } = await adminSupabase.storage
      .from("documents").download(storagePath);

    if (downloadError || !fileData) {
      await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
      return NextResponse.json({ error: "Gagal mengunduh file" }, { status: 500 });
    }

    const arrayBuffer = await fileData.arrayBuffer();

    // 3. Extract text
    let extractedText = "";
    let pageCount = 0;
    try {
      const { extractText } = await import("unpdf");
      const uint8 = new Uint8Array(arrayBuffer);
      const result = await extractText(uint8, { mergePages: true });
      extractedText = Array.isArray(result.text) ? result.text.join("\n") : (result.text || "");
      pageCount = result.totalPages || 0;
    } catch (pdfError) {
      console.error("[Process] PDF extract error:", pdfError);
    }

    // 4. AI Analysis (kategori + klasifikasi sekaligus)
    // Deteksi scan dokumen
    const isScanned = extractedText.trim().length < 20;
    console.log(`[Process] is_scanned: ${isScanned}, text length: ${extractedText.length}`);

    // Batas ukuran file untuk vision — base64 menambah ~33% ukuran, API limit 50MB per request.
    // 15MB asli -> ~20MB base64, aman dengan margin besar untuk teks prompt tambahan.
    const VISION_MAX_FILE_BYTES = 15 * 1024 * 1024;
    let usedVision = false;

    let aiResult;
    if (isScanned && arrayBuffer.byteLength <= VISION_MAX_FILE_BYTES) {
      console.log(`[Process] Dokumen scan terdeteksi, mencoba analisis via vision (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);
      const pdfBase64 = Buffer.from(arrayBuffer).toString("base64");
      aiResult = await analyzeScannedDocument(pdfBase64, fileName);
      usedVision = true;
    } else {
      if (isScanned) {
        console.log(`[Process] Dokumen scan tapi terlalu besar untuk vision (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB), lanjut tanpa analisis konten`);
      }
      const textPreview = extractedText.slice(0, 7000); // ~2 halaman
      aiResult = await analyzeDocumentPreview(textPreview || `Nama file: ${fileName}`, fileName);
    }

    // 5. Tentukan klasifikasi final
    // Dokumen scan TANPA vision (gagal/terlalu besar): default confidential karena AI tidak bisa baca isi.
    // Dokumen scan DENGAN vision berhasil: pakai hasil analisis vision, sama seperti dokumen teks biasa.
    const aiClassification = (isScanned && !usedVision) ? "confidential" : aiResult.classification;
    const finalClassification = classificationOverride || aiClassification;
    const isOverridden = !!classificationOverride && classificationOverride !== aiClassification;

    // Simpan potongan teks untuk pencarian — kalau via vision, tidak ada extractedText asli,
    // jadi pakai ringkasan AI sebagai gantinya supaya tetap bisa dicari
    const textPreview = usedVision
      ? (aiResult.summary || "")
      : extractedText.slice(0, 7000); // ~2 halaman

    // 6. Update document
    await supabase.from("documents").update({
      category: aiResult.category,
      category_confidence: aiResult.category_confidence,
      summary: aiResult.summary,
      extracted_text_preview: textPreview,
      page_count: pageCount,
      tags: aiResult.tags,
      is_scanned: isScanned,
      classification: finalClassification,
      classification_ai_suggestion: aiClassification,
      classification_confidence: (isScanned && !usedVision) ? 0 : aiResult.classification_confidence,
      classification_overridden: isOverridden,
      classification_override_reason: isOverridden ? (overrideReason || null) : null,
      status: "processing",
      updated_at: new Date().toISOString(),
    }).eq("id", doc.id);

    // 7. Embeddings
    // Untuk dokumen via vision (tidak ada extractedText), pakai ringkasan+tags AI sebagai
    // bahan embedding supaya dokumen tetap muncul di semantic search
    const embeddingSourceText = usedVision
      ? [aiResult.summary, ...(aiResult.tags || [])].filter(Boolean).join(". ")
      : extractedText;

    if (embeddingSourceText.length > 10) {
      const chunks = chunkText(embeddingSourceText);
      const embeddingPromises = chunks.slice(0, 20).map(async (chunk, index) => {
        try {
          const embedding = await generateEmbedding(chunk);
          if (embedding.length > 0) {
            return adminSupabase.from("document_embeddings").insert({
              document_id: doc.id,
              chunk_index: index,
              chunk_text: chunk,
              embedding: JSON.stringify(embedding),
            });
          }
        } catch (e) {
          console.error(`[Process] Embedding chunk ${index} error:`, e);
        }
      });
      await Promise.allSettled(embeddingPromises);
    }

    // 8. Mark draft — dokumen belum dikonfirmasi user
    await supabase.from("documents").update({
      status: "draft",
      updated_at: new Date().toISOString(),
    }).eq("id", doc.id);

    // Audit log akan dicatat saat user konfirmasi di update-classification

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        title: doc.title,
        category: aiResult.category,
        summary: aiResult.summary,
        tags: aiResult.tags,
        classification: finalClassification,
        classification_ai_suggestion: aiClassification,
        classification_confidence: (isScanned && !usedVision) ? 0 : aiResult.classification_confidence,
        classification_overridden: isOverridden,
        classification_reason: aiResult.classification_reason,
        is_scanned: isScanned,
      },
    });

  } catch (error) {
    console.error("[Process] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
