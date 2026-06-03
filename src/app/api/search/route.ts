import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedSearchQuery } from "@/lib/gemini";
import type { SearchResult } from "@/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ results: [] });

  const results: (SearchResult & { uploader_name?: string })[] = [];
  const seenIds = new Set<string>();

  // 1. EXACT MATCH
  const { data: exactDocs } = await supabase
    .from("documents")
    .select("*")
    .eq("status", "ready")
    .or(`title.ilike.%${query}%,summary.ilike.%${query}%,extracted_text_page1.ilike.%${query}%`)
    .limit(5);

  if (exactDocs) {
    for (const doc of exactDocs) {
      seenIds.add(doc.id);
      results.push({ document: doc, score: 1.0, snippet: getSnippet(doc.extracted_text_page1 || doc.summary || "", query), match_type: "exact" });
    }
  }

  // 2. SEMANTIC SEARCH
  const isConceptual = query.trim().length > 2;
  if (isConceptual) {
    try {
      const queryEmbedding = await embedSearchQuery(query);
      const { data: semanticResults } = await supabase.rpc("search_documents_semantic_all", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: 0.4,
        match_count: 10,
      });

      if (semanticResults) {
        const semanticDocIds = [...new Set(semanticResults.map((r: { document_id: string }) => r.document_id))]
          .filter(id => !seenIds.has(id as string));

        if (semanticDocIds.length > 0) {
          const { data: semanticDocs } = await supabase.from("documents").select("*").in("id", semanticDocIds);
          if (semanticDocs) {
            for (const doc of semanticDocs) {
              const bestChunk = semanticResults.find((r: { document_id: string; similarity: number; chunk_text: string }) => r.document_id === doc.id);
              seenIds.add(doc.id);
              results.push({ document: doc, score: bestChunk?.similarity || 0.5, snippet: bestChunk?.chunk_text?.slice(0, 200) || doc.summary || "", match_type: "semantic" });
            }
          }
        }
      }
    } catch (error) {
      console.error("[Search] Semantic error:", error);
    }
  }

  results.sort((a, b) => b.score - a.score);

  // Fetch uploader names
  const userIds = [...new Set(results.map(r => r.document.user_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
  const profileMap = Object.fromEntries((profiles || []).map((p: { id: string; full_name: string; email: string }) => [p.id, p.full_name || p.email]));
  const resultsWithUploader = results.map(r => ({ ...r, uploader_name: profileMap[r.document.user_id] || "Unknown" }));

  // Log search
  await supabase.from("search_history").insert({ user_id: user.id, query, result_count: results.length });

  return NextResponse.json({ results: resultsWithUploader, query });
}

function getSnippet(text: string, query: string, contextLength = 200): string {
  const lowerText = text.toLowerCase();
  const idx = lowerText.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, contextLength);
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + contextLength);
  return (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
}
