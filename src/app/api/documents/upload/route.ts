import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { analyzeDocumentPage1, generateEmbedding, chunkText } from "@/lib/gemini";
import { generateStoragePath } from "@/lib/utils";

// Max 100MB, 5 menit timeout (Vercel Pro / Railway)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = await createAdminClient();

    // Verify auth
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

    // 1. Upload ke Supabase Storage
    const storagePath = generateStoragePath(user.id, file.name);
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await adminSupabase.storage
      .from("documents")
      .upload(storagePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("[Upload] Storage error:", uploadError);
      return NextResponse.json({ error: "Gagal upload file" }, { status: 500 });
    }

    // 2. Create document record (status: processing)
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

    // 3. Extract text dari PDF (server-side)
    let extractedText = "";
    let pageCount = 0;

    try {
      // Dynamic import untuk menghindari edge runtime issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParseModule: any = await import("pdf-parse");
      const pdfParse = pdfParseModule.default ?? pdfParseModule;
      const pdfData = await pdfParse(Buffer.from(fileBuffer), { max: 15 }); // max 15 halaman
      extractedText = pdfData.text;
      pageCount = pdfData.numpages;
    } catch (pdfError) {
      console.error("[Upload] PDF parse error:", pdfError);
      // Lanjut meski gagal extract — dokumen tetap tersimpan
    }

    // 4. AI Analysis halaman 1
    const textPage1 = extractedText.slice(0, 4000); // ~halaman pertama
    const aiResult = await analyzeDocumentPage1(textPage1, file.name);

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
        status: extractedText.length > 10 ? "processing" : "ready", // masih processing jika ada text
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    // 6. Generate embeddings jika ada teks
    if (extractedText.length > 10) {
      const chunks = chunkText(extractedText);
      const embeddingPromises = chunks.slice(0, 20).map(async (chunk, index) => {
        const embedding = await generateEmbedding(chunk);
        return adminSupabase.from("document_embeddings").insert({
          document_id: doc.id,
          chunk_index: index,
          chunk_text: chunk,
          embedding: JSON.stringify(embedding),
        });
      });

      await Promise.allSettled(embeddingPromises);

      // Mark as ready
      await supabase
        .from("documents")
        .update({ status: "ready", updated_at: new Date().toISOString() })
        .eq("id", doc.id);
    }

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
