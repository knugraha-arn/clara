import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { analyzeDocumentPage1, generateEmbedding, chunkText } from "@/lib/gemini";
import { generateStoragePath } from "@/lib/utils";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = await createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "File PDF diperlukan" }, { status: 400 });
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "Ukuran file maksimal 100MB" }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();

    // 1. Upload ke Supabase Storage
    const storagePath = generateStoragePath(user.id, file.name);
    const { error: uploadError } = await adminSupabase.storage
      .from("documents")
      .upload(storagePath, fileBuffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      console.error("[Upload] Storage error:", uploadError);
      return NextResponse.json({ error: "Gagal upload file" }, { status: 500 });
    }

    // 2. Create document record
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        title: title || file.name.replace(".pdf", ""),
        file_name: file.name,
        file_path: storagePath,
        file_size: file.size,
        mime_type: "application/pdf",
        status: "processing",
      })
      .select()
      .single();

    if (docError || !doc) {
      console.error("[Upload] DB insert error:", docError);
      return NextResponse.json({ error: "Gagal menyimpan dokumen" }, { status: 500 });
    }

    // 3. Extract text menggunakan unpdf (serverless-friendly)
    let extractedText = "";
    let pageCount = 0;

    try {
      const { extractText } = await import("unpdf");
      const uint8 = new Uint8Array(fileBuffer);
      const result = await extractText(uint8, { mergePages: true });
      extractedText = Array.isArray(result.text) ? result.text.join("\n") : (result.text || "");
      pageCount = result.totalPages || 0;
      console.log(`[Upload] Extracted ${extractedText.length} chars, ${pageCount} pages`);
    } catch (pdfError) {
      console.error("[Upload] PDF extract error:", pdfError);
      // Lanjut tanpa teks — dokumen tetap tersimpan
    }

    // 4. AI Analysis halaman 1
    const textPage1 = extractedText.slice(0, 4000);
    const aiResult = await analyzeDocumentPage1(textPage1 || `Nama file: ${file.name}`, file.name);

    // 5. Update document dengan hasil AI
    await supabase
      .from("documents")
      .update({
        category: aiResult.category,
        category_confidence: aiResult.category_confidence,
        summary: aiResult.summary,
        extracted_text_page1: textPage1,
        page_count: pageCount,
        tags: aiResult.tags,
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    // 6. Generate embeddings jika ada teks
    if (extractedText.length > 10) {
      const chunks = chunkText(extractedText);
      const embeddingPromises = chunks.slice(0, 20).map(async (chunk, index) => {
        try {
          const embedding = await generateEmbedding(chunk);
          return adminSupabase.from("document_embeddings").insert({
            document_id: doc.id,
            chunk_index: index,
            chunk_text: chunk,
            embedding: JSON.stringify(embedding),
          });
        } catch (e) {
          console.error(`[Upload] Embedding chunk ${index} error:`, e);
        }
      });

      await Promise.allSettled(embeddingPromises);
    }

    // 7. Mark as ready
    await supabase
      .from("documents")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("id", doc.id);

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        title: doc.title,
        category: aiResult.category,
        summary: aiResult.summary,
        tags: aiResult.tags,
        status: "ready",
      },
    });

  } catch (error) {
    console.error("[Upload] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
