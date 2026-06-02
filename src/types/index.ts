// ============================================
// CLARA - Global Type Definitions
// ============================================

export type DocumentCategory =
  | "surat_masuk"
  | "surat_keluar"
  | "kontrak"
  | "memo"
  | "laporan"
  | "kebijakan"
  | "undangan"
  | "pengumuman"
  | "lainnya";

export type DocumentStatus = "processing" | "ready" | "error";

export interface Document {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  category: DocumentCategory;
  category_confidence: number; // 0-1, AI confidence score
  summary: string | null; // AI-generated summary dari halaman 1
  extracted_text_page1: string | null;
  status: DocumentStatus;
  page_count: number | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DocumentEmbedding {
  id: string;
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[]; // pgvector
  created_at: string;
}

export interface SearchResult {
  document: Document;
  score: number;
  snippet: string;
  match_type: "semantic" | "exact" | "hybrid";
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: "super_admin" | "admin" | "manager" | "auditor";
  created_at: string;
}

export interface UploadProgress {
  stage: "uploading" | "extracting" | "analyzing" | "embedding" | "done" | "error";
  progress: number; // 0-100
  message: string;
}

export interface AiAnalysisResult {
  summary: string;
  category: DocumentCategory;
  category_confidence: number;
  tags: string[];
  document_date: string | null;
  sender: string | null;
  recipient: string | null;
}
