import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function allowedClassifications(role: string): string[] {
  if (["admin", "super_admin"].includes(role)) return ["public", "internal", "confidential", "restricted"];
  if (["contributor", "auditor"].includes(role)) return ["public", "internal", "confidential"];
  return ["public", "internal"];
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const classifications = allowedClassifications(profile?.role || "viewer");

  const { documentId } = await request.json();
  if (!documentId) return NextResponse.json({ duplicates: [] });

  // Ambil info dokumen yang baru diupload
  const { data: currentDoc } = await supabase
    .from("documents")
    .select("id, title, file_name, file_size, is_scanned")
    .eq("id", documentId)
    .single();

  if (!currentDoc) return NextResponse.json({ duplicates: [] });

  // Tunggu sebentar untuk pastikan embedding tersimpan (untuk non-scan)
  await new Promise(r => setTimeout(r, 1000));

  // Ambil embedding
  const { data: newEmbeddings } = await supabase
    .from("document_embeddings")
    .select("embedding")
    .eq("document_id", documentId)
    .limit(1);

  const hasEmbedding = newEmbeddings && newEmbeddings.length > 0;

  // --- METODE 1: Embedding similarity (dokumen digital) ---
  if (hasEmbedding) {
    let embedding = newEmbeddings[0].embedding;
    if (typeof embedding === "string") {
      try { embedding = JSON.parse(embedding); } catch { embedding = null; }
    }

    if (Array.isArray(embedding) && embedding.length > 0) {
      const { data: similarDocs } = await supabase.rpc("search_documents_semantic_all", {
        query_embedding: JSON.stringify(embedding),
        match_threshold: 0.85,
        match_count: 6,
      });

      if (similarDocs && similarDocs.length > 0) {
        const otherDocIds = [...new Set(
          similarDocs
            .filter((r: { document_id: string }) => r.document_id !== documentId)
            .map((r: { document_id: string }) => r.document_id)
        )];

        if (otherDocIds.length > 0) {
          const { data: similarDocDetails } = await supabase
            .from("documents")
            .select("id, title, category, classification, created_at")
            .in("id", otherDocIds)
            .eq("status", "ready")
            .in("classification", classifications);

          if (similarDocDetails && similarDocDetails.length > 0) {
            const duplicates = similarDocDetails.map((doc: {
              id: string; title: string; category: string; classification: string; created_at: string;
            }) => {
              const bestMatch = similarDocs.find((r: { document_id: string; similarity: number }) => r.document_id === doc.id);
              return {
                id: doc.id,
                title: doc.title,
                category: doc.category,
                classification: doc.classification,
                created_at: doc.created_at,
                similarity: Math.round((bestMatch?.similarity || 0) * 100),
                match_type: "content",
              };
            });
            return NextResponse.json({ duplicates });
          }
        }
      }
    }
  }

  // --- METODE 2: Filename similarity (fallback untuk scan atau tidak ada embedding) ---
  // Cari dokumen dengan nama file yang sama atau mirip
  const { data: filenameDocs } = await supabase
    .from("documents")
    .select("id, title, category, classification, created_at, file_name, file_size")
    .eq("status", "ready")
    .in("classification", classifications)
    .neq("id", documentId)
    .or(`file_name.eq.${currentDoc.file_name},title.eq.${currentDoc.title}`);

  if (filenameDocs && filenameDocs.length > 0) {
    const duplicates = filenameDocs.map((doc: {
      id: string; title: string; category: string; classification: string; created_at: string; file_name: string; file_size: number;
    }) => {
      // Hitung similarity berdasarkan nama file dan ukuran
      const sameFileName = doc.file_name === currentDoc.file_name;
      const sameSize = Math.abs(doc.file_size - currentDoc.file_size) < 1024; // toleransi 1KB
      const similarity = sameFileName && sameSize ? 99 : sameFileName ? 90 : 80;
      return {
        id: doc.id,
        title: doc.title,
        category: doc.category,
        classification: doc.classification,
        created_at: doc.created_at,
        similarity,
        match_type: "filename",
      };
    });
    return NextResponse.json({ duplicates });
  }

  return NextResponse.json({ duplicates: [] });
}
