import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId } = await request.json();
  if (!documentId) return NextResponse.json({ duplicates: [] });

  // Ambil embedding dari dokumen yang baru diupload
  const { data: newEmbeddings } = await supabase
    .from("document_embeddings")
    .select("embedding, chunk_text")
    .eq("document_id", documentId)
    .limit(3);

  if (!newEmbeddings || newEmbeddings.length === 0) {
    return NextResponse.json({ duplicates: [] });
  }

  // Gunakan embedding pertama untuk cek similarity
  const firstEmbedding = newEmbeddings[0].embedding;

  const { data: similarDocs } = await supabase.rpc("search_documents_semantic_all", {
    query_embedding: JSON.stringify(firstEmbedding),
    match_threshold: 0.85,
    match_count: 5,
  });

  if (!similarDocs || similarDocs.length === 0) {
    return NextResponse.json({ duplicates: [] });
  }

  // Filter out dokumen itu sendiri
  const otherDocIds = [...new Set(
    similarDocs
      .filter((r: { document_id: string }) => r.document_id !== documentId)
      .map((r: { document_id: string }) => r.document_id)
  )];

  if (otherDocIds.length === 0) return NextResponse.json({ duplicates: [] });

  const { data: similarDocDetails } = await supabase
    .from("documents")
    .select("id, title, category, classification, created_at")
    .in("id", otherDocIds)
    .eq("status", "ready");

  const duplicates = (similarDocDetails || []).map((doc: {
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
    };
  });

  return NextResponse.json({ duplicates });
}
