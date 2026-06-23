import type { ComplianceControl } from "@/types";

/**
 * Pemetaan CLARA terhadap klausul ISO 9001:2015 (kontrol dokumen) dan
 * ISO 27001:2022 Annex A (kontrol relevan untuk document management system).
 *
 * Ini BUKAN klaim sertifikasi — ini working checklist internal untuk lihat
 * mana yang sudah didukung sistem, mana yang masih manual/policy-level,
 * dan mana yang benar-benar gap teknis.
 *
 * `metricId` (kalau ada) dihubungkan ke live check di checks.ts — nilainya
 * di-resolve di API route, bukan di sini.
 */

export interface ControlDefinition extends Omit<ComplianceControl, "metric"> {
  metricId?: string;
}

export const COMPLIANCE_CONTROLS: ControlDefinition[] = [
  // ===================== ISO 9001:2015 =====================
  {
    id: "iso9001-7.5.2-creation",
    standard: "iso9001",
    clause: "§7.5.2",
    title: "Pembuatan & identifikasi dokumen",
    description: "Dokumen harus punya identitas jelas (judul, format, penomoran) saat dibuat.",
    status: "implemented",
    evidence: "Setiap upload otomatis dapat title, kategori (AI-assisted), klasifikasi, dan opsional nomor surat formal (party + kategori + tanggal + sequence) dari modul Nomor Surat.",
  },
  {
    id: "iso9001-7.5.3-changes",
    standard: "iso9001",
    clause: "§7.5.3",
    title: "Kontrol perubahan dokumen terkendali",
    description: "Perubahan terhadap dokumen yang sudah terbit harus direview & disetujui pihak berwenang, dan tercatat.",
    status: "implemented",
    evidence: "Fitur Edit Request: contributor/admin mengajukan perubahan metadata (judul, kategori, ringkasan, tag, masa berlaku) dengan alasan wajib; admin/super_admin meninjau & approve/reject; setiap langkah tercatat ke audit trail (edit_requested/approved/rejected/auto_approved).",
    metricId: "editRequestBacklog",
  },
  {
    id: "iso9001-8.5.2-traceability",
    standard: "iso9001",
    clause: "§8.5.2",
    title: "Identifikasi & keterlacakan (traceability)",
    description: "Harus bisa dilacak siapa melakukan apa terhadap suatu dokumen, dan kapan.",
    status: "implemented",
    evidence: "Audit trail `document_logs` mencatat uploaded/viewed/downloaded/deleted/classification_changed beserta user, email, IP, user agent, dan timestamp untuk tiap dokumen.",
    metricId: "auditLogVolume",
  },
  {
    id: "iso9001-7.5.3-obsolete",
    standard: "iso9001",
    clause: "§7.5.3.2(c)",
    title: "Penandaan dokumen usang/kedaluwarsa",
    description: "Dokumen yang sudah tidak berlaku harus ditandai jelas supaya tidak salah dipakai (unintended use of obsolete documents).",
    status: "gap",
    evidence: "Retention date & masa berlaku (`valid_until`) sudah dilacak per dokumen, termasuk default otomatis per kategori dan notifikasi 'segera expired' di dashboard Statistik.",
    gapNote: "Belum ada mekanisme menandai dokumen sebagai obsolete/superseded secara eksplisit ketika valid_until lewat — dokumen yang expired tetap terlihat normal di register, hanya beda warna status di Statistik. Perlu field/flag + badge visual + filter.",
    metricId: "expiredUnflagged",
  },
  {
    id: "iso9001-8.5.3-approval",
    standard: "iso9001",
    clause: "§8.5.3 / §7.5.2",
    title: "Persetujuan sebelum dokumen resmi terbit",
    description: "Dokumen idealnya disetujui pihak berwenang sebelum dianggap 'resmi' dan bisa diakses pengguna lain.",
    status: "gap",
    evidence: "Ada workflow draft → ready di upload (uploader konfirmasi sebelum dokumen jadi 'ready' dan ter-index/searchable).",
    gapNote: "Transisi draft → ready saat ini dikontrol oleh uploader sendiri, bukan oleh approver independen. Tidak ada langkah sign-off terpisah sebelum dokumen dianggap resmi dan dapat diakses pihak lain — beda dengan Edit Request yang sudah punya approval terpisah untuk *perubahan*, tapi belum untuk *penerbitan pertama*.",
  },
  {
    id: "iso9001-8.5.3-access",
    standard: "iso9001",
    clause: "§8.5.3",
    title: "Ketersediaan & perlindungan akses dokumen",
    description: "Dokumen harus tersedia untuk yang berhak, dan terlindungi dari yang tidak berhak.",
    status: "implemented",
    evidence: "4-tier klasifikasi (public/internal/confidential/restricted) ditegakkan di level API untuk role viewer/auditor/contributor/admin/super_admin, konsisten di preview, download, dan search.",
  },
  {
    id: "iso9001-9.1-monitoring",
    standard: "iso9001",
    clause: "§9.1",
    title: "Pemantauan & pengukuran kinerja",
    description: "Organisasi harus memantau data terkait sistem manajemen dokumen (volume, aktivitas, kepatuhan retensi, dll).",
    status: "implemented",
    evidence: "Dashboard Statistik: overview arsip, aktivitas 30 hari, top uploader/downloader, akses dokumen sensitif, dan export PDF untuk laporan periodik.",
  },

  // ===================== ISO 27001:2022 =====================
  {
    id: "iso27001-5.12-classification",
    standard: "iso27001",
    clause: "A.5.12",
    title: "Klasifikasi informasi",
    description: "Informasi harus diklasifikasikan sesuai kebutuhan kerahasiaan, dan klasifikasi itu konsisten diterapkan.",
    status: "implemented",
    evidence: "Klasifikasi 4-tingkat dengan AI-assisted suggestion saat upload, override manual dengan alasan wajib, dan aturan eksplisit (invoice/PO/berita acara default restricted).",
    gapNote: "Live check di bawah memverifikasi apakah aturan itu konsisten diterapkan di data aktual, bukan cuma di prompt AI.",
    metricId: "classificationPolicyViolations",
  },
  {
    id: "iso27001-5.13-labelling",
    standard: "iso27001",
    clause: "A.5.13",
    title: "Pelabelan informasi",
    description: "Label klasifikasi harus terlihat jelas pada informasi/dokumen.",
    status: "partial",
    evidence: "Badge klasifikasi tampil konsisten di UI (Dokumen, Register, Search, Statistik).",
    gapNote: "Label hanya ada di UI CLARA — tidak ter-embed ke file PDF itu sendiri (watermark/footer), jadi hilang konteks kalau file diunduh & dibuka di luar sistem.",
  },
  {
    id: "iso27001-8.15-logging",
    standard: "iso27001",
    clause: "A.8.15",
    title: "Logging",
    description: "Event yang relevan (akses, perubahan, tindakan privileged) harus tercatat.",
    status: "implemented",
    evidence: "Audit trail mencakup 20+ event type: upload/view/download/delete, lifecycle nomor surat, perubahan role/suspend, party, hingga edit request — dibangun bertahap lewat beberapa migration re-audit.",
    metricId: "auditLogVolume",
  },
  {
    id: "iso27001-8.16-monitoring",
    standard: "iso27001",
    clause: "A.8.16",
    title: "Pemantauan aktivitas privileged",
    description: "Tindakan oleh pengguna dengan privilege tinggi (admin/super_admin) harus termonitor & tercatat presisi.",
    status: "implemented",
    evidence: "Event terpisah & presisi untuk role_changed, user_suspended/unsuspended, number_approved/rejected/voided, edit_approved/rejected, party_created/unlinked — sengaja dipisah dari event generik supaya log lebih bisa ditelusuri.",
    metricId: "privilegedEvents90d",
  },
  {
    id: "iso27001-8.3-access-restriction",
    standard: "iso27001",
    clause: "A.8.3",
    title: "Pembatasan akses informasi",
    description: "Akses ke informasi harus dibatasi sesuai kebijakan kontrol akses yang ditetapkan.",
    status: "implemented",
    evidence: "RLS Supabase + pengecekan role & klasifikasi konsisten di setiap route API (preview, download, search, documents, edit-requests).",
  },
  {
    id: "iso27001-5.3-segregation",
    standard: "iso27001",
    clause: "A.5.3",
    title: "Segregation of duties",
    description: "Tugas & tanggung jawab yang konflik harus dipisah ke pihak berbeda (mis. pengaju vs penyetuju).",
    status: "implemented",
    evidence: "Requester edit request tidak bisa approve permintaannya sendiri (kecuali super_admin, yang sengaja auto-approved karena tidak ada level di atasnya — exception yang dicatat eksplisit sebagai 'auto_approved', bukan disembunyikan).",
  },
  {
    id: "iso27001-8.10-deletion",
    standard: "iso27001",
    clause: "A.8.10",
    title: "Penghapusan informasi",
    description: "Informasi yang sudah tidak diperlukan harus dihapus secara terkendali sesuai kebijakan retensi.",
    status: "partial",
    evidence: "Setiap delete tercatat di audit trail (event `deleted`), dan retention_date dihitung otomatis per kategori dokumen.",
    gapNote: "Belum ada proses terjadwal yang menegakkan retensi — dokumen yang retention_date-nya lewat tidak otomatis di-review atau dihapus, hanya muncul di daftar 'segera expired'.",
    metricId: "documentsMissingRetention",
  },
  {
    id: "iso27001-5.37-procedures",
    standard: "iso27001",
    clause: "A.5.37",
    title: "Dokumentasi prosedur operasional",
    description: "Prosedur operasional (siapa boleh apa, alur approval, dsb) harus terdokumentasi formal, bukan cuma tersirat di kode.",
    status: "partial",
    evidence: "Aturan bisnis (role matrix, alur approval, klasifikasi) konsisten diterapkan di kode dan bisa diaudit dari sini.",
    gapNote: "Belum ada dokumen kebijakan formal (di luar kode) yang versioned dan disetujui manajemen — kalau auditor eksternal minta 'SOP tertulis', belum ada artefak terpisah dari implementasi.",
  },
];
