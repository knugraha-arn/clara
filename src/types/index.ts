export type DocumentCategory =
  | "surat_masuk" | "surat_keluar" | "kontrak" | "nda" | "memo"
  | "prosedur" | "kebijakan" | "instruksi_kerja" | "template"
  | "laporan" | "undangan" | "pengumuman"
  | "invoice" | "po" | "berita_acara" | "lainnya";

export type DocumentStatus = "processing" | "ready" | "error";
export type DocumentClassification = "public" | "internal" | "confidential" | "restricted";
export type RetentionPolicy = "standard" | "extended" | "permanent" | "custom";
export type AuditEventType =
  | "uploaded" | "viewed" | "downloaded" | "deleted"
  | "searched" | "classification_changed" | "role_changed";

export interface Document {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  category: DocumentCategory;
  category_confidence: number;
  summary: string | null;
  extracted_text_page1: string | null;
  status: DocumentStatus;
  page_count: number | null;
  tags: string[];
  classification: DocumentClassification;
  classification_ai_suggestion: DocumentClassification | null;
  classification_confidence: number;
  classification_overridden: boolean;
  classification_override_reason: string | null;
  retention_date: string | null;
  retention_policy: RetentionPolicy;
  valid_until: string | null;
  is_scanned: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentWithUploader extends Document {
  uploader_name: string;
}

export interface DocumentLog {
  id: string;
  document_id: string | null;
  document_title: string;
  user_id: string | null;
  user_email: string;
  user_name: string | null;
  event_type: AuditEventType;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface MasterDocumentRegister {
  no_urut: number;
  id: string;
  judul_dokumen: string;
  nama_file: string;
  kategori: string;
  klasifikasi: string;
  diupload_oleh: string;
  email_uploader: string;
  tanggal_upload: string;
  jumlah_halaman: number | null;
  ukuran_kb: number;
  masa_berlaku: string | null;
  status_masa_berlaku: "Aktif" | "Akan Berakhir" | "Berakhir" | null;
  retensi_sampai: string | null;
  status_retensi: "Active" | "Expiring Soon" | "Expired";
  tags: string[];
  ringkasan: string | null;
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
  role: "super_admin" | "admin" | "contributor" | "auditor" | "viewer";
  created_at: string;
}

export interface UploadProgress {
  stage: "uploading" | "extracting" | "analyzing" | "embedding" | "done" | "error";
  progress: number;
  message: string;
}

export interface AiAnalysisResult {
  summary: string;
  category: DocumentCategory;
  category_confidence: number;
  classification: DocumentClassification;
  classification_confidence: number;
  classification_reason: string;
  tags: string[];
  document_date: string | null;
  sender: string | null;
  recipient: string | null;
}
