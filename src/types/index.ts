export type DocumentCategory =
  | "surat_masuk" | "surat_keluar" | "kontrak" | "nda" | "memo"
  | "prosedur" | "kebijakan" | "instruksi_kerja" | "template"
  | "laporan" | "undangan" | "pengumuman"
  | "invoice" | "po" | "berita_acara" | "lainnya";

export type DocumentStatus = "draft" | "processing" | "ready" | "error";
export type DocumentClassification = "public" | "internal" | "confidential" | "restricted";
export type RetentionPolicy = "standard" | "extended" | "permanent" | "custom";
export type AuditEventType =
  | "uploaded" | "viewed" | "downloaded" | "deleted"
  | "classification_changed" | "role_changed"
  | "user_suspended" | "user_unsuspended"
  | "number_created"
  | "number_approved" | "number_revision_requested" | "number_rejected"
  | "number_voided" | "number_resubmitted" | "number_linked"
  | "number_description_edited"
  | "party_created" | "party_unlinked"
  | "edit_requested" | "edit_approved" | "edit_rejected" | "edit_auto_approved";

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
  extracted_text_preview: string | null;
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

export interface DocumentEditableFields {
  title?: string;
  category?: DocumentCategory;
  summary?: string;
  tags?: string[];
  valid_until?: string | null;
  classification?: DocumentClassification;
}

export interface DocumentEditRequest {
  id: string;
  document_id: string;
  requested_by: string;
  requested_by_name: string | null;
  requested_by_role: string | null;
  requested_at: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  auto_approved: boolean;
  created_at: string;
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

export type ComplianceStandard = "iso9001" | "iso27001";
export type ComplianceStatus = "implemented" | "partial" | "gap";

export interface ComplianceMetric {
  label: string;
  value: number | string;
  /** true kalau angka ini menandakan ada yang perlu diperhatikan (misal backlog > 0) */
  flagged?: boolean;
}

export interface ComplianceControl {
  id: string;
  standard: ComplianceStandard;
  clause: string;
  title: string;
  description: string;
  status: ComplianceStatus;
  evidence: string;
  gapNote?: string;
  metric?: ComplianceMetric;
}

export interface ComplianceSummary {
  total: number;
  implemented: number;
  partial: number;
  gap: number;
  scorePct: number;
}

export interface ComplianceReport {
  generatedAt: string;
  controls: ComplianceControl[];
  summary: {
    overall: ComplianceSummary;
    iso9001: ComplianceSummary;
    iso27001: ComplianceSummary;
  };
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
  /** Tanggal kadaluarsa/berakhir yang disebut EKSPLISIT di teks dokumen, kalau ada */
  suggested_valid_until: string | null;
  /** Hal-hal yang AI nilai kurang/perlu diperhatikan — kosong kalau tidak ada temuan */
  compliance_flags: string[];
}
