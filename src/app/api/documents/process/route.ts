import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { analyzeDocumentPreview, generateEmbedding, chunkText } from "@/lib/openai";

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

    // 3. Extract text
    let extractedText = "";
    let pageCount = 0;
    try {
      const { extractText } = await import("unpdf");
      const arrayBuffer = await fileData.arrayBuffer();
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

    const textPreview = extractedText.slice(0, 7000); // ~2 halaman
    const aiResult = await analyzeDocumentPreview(textPreview || `Nama file: ${fileName}`, fileName);

    // 5. Tentukan klasifikasi final
    // Dokumen scan: default confidential karena AI tidak bisa baca isi
    const aiClassification = isScanned ? "confidential" : aiResult.classification;
    const finalClassification = classificationOverride || aiClassification;
    const isOverridden = !!classificationOverride && classificationOverride !== aiClassification;

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
      classification_confidence: isScanned ? 0 : aiResult.classification_confidence,
      classification_overridden: isOverridden,
      classification_override_reason: isOverridden ? (overrideReason || null) : null,
      status: "processing",
      updated_at: new Date().toISOString(),
    }).eq("id", doc.id);

    // 7. Embeddings
    if (extractedText.length > 10) {
      const chunks = chunkText(extractedText);
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
        classification_confidence: isScanned ? 0 : aiResult.classification_confidence,
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
