/**
 * Pemetaan error teknis -> pesan yang manusiawi.
 *
 * Dipakai di dua sisi: API routes (server, supaya tidak bocorkan raw error
 * ke client) dan komponen upload (client, sebagai fallback kalau error
 * datang dari tempat lain seperti Supabase Storage SDK langsung).
 *
 * Filosofi: pesan asli (raw) tetap di-log ke console untuk debugging,
 * tapi yang dilihat user adalah cerita singkat — apa yang terjadi, kenapa,
 * dan apa yang sebaiknya dilakukan — bukan stack trace atau "Internal
 * server error".
 */

export interface FriendlyError {
  title: string;
  message: string;
  action: string;
  /** Pesan teknis asli, untuk ditampilkan di balik toggle "Detail teknis" (opsional, untuk lapor bug) */
  detail?: string;
}

interface ErrorPattern {
  test: (raw: string) => boolean;
  build: (raw: string) => FriendlyError;
}

const PATTERNS: ErrorPattern[] = [
  {
    // Network/koneksi putus di tengah upload atau fetch
    test: (r) => /failed to fetch|networkerror|net::err|fetch failed/i.test(r),
    build: (raw) => ({
      title: "Koneksi terputus",
      message: "Sepertinya koneksi internet kamu putus di tengah proses upload atau analisis dokumen.",
      action: "Cek koneksi internet kamu, lalu coba upload ulang.",
      detail: raw,
    }),
  },
  {
    // Timeout — biasanya dokumen besar/scan yang prosesnya lama
    test: (r) => /timeout|timed out|aborterror|etimedout/i.test(r),
    build: (raw) => ({
      title: "Proses terlalu lama",
      message: "Dokumen ini butuh waktu lebih lama dari biasanya untuk dianalisis — kemungkinan karena ukuran file atau jumlah halaman yang besar.",
      action: "Coba lagi sebentar, atau kalau dokumennya hasil scan, coba kompres ukurannya dulu.",
      detail: raw,
    }),
  },
  {
    // File terlalu besar
    test: (r) => /payload too large|413|exceeds.*size|file.*besar/i.test(r),
    build: (raw) => ({
      title: "Ukuran file terlalu besar",
      message: "Dokumen ini melebihi batas ukuran yang bisa diproses sistem, terutama untuk dokumen hasil scan yang dianalisis sebagai gambar.",
      action: "Coba kompres PDF-nya dulu (misal lewat tools kompres PDF online) lalu upload ulang.",
      detail: raw,
    }),
  },
  {
    // Sesi habis / belum login
    test: (r) => /unauthorized|401|tidak terautentikasi|jwt expired|session/i.test(r),
    build: (raw) => ({
      title: "Sesi kamu sudah habis",
      message: "Sepertinya sesi login kamu sudah berakhir, jadi sistem tidak bisa memproses upload ini.",
      action: "Refresh halaman dan login ulang, lalu coba upload lagi.",
      detail: raw,
    }),
  },
  {
    // Rate limit / quota dari OpenAI atau service eksternal lain
    test: (r) => /rate limit|429|quota|insufficient_quota/i.test(r),
    build: (raw) => ({
      title: "Layanan AI sedang sibuk",
      message: "Sistem analisis AI sedang menerima banyak permintaan sekaligus sehingga dokumenmu belum bisa dianalisis.",
      action: "Tunggu sebentar (sekitar 1-2 menit) lalu coba upload ulang.",
      detail: raw,
    }),
  },
  {
    // Duplikat path/file di storage
    test: (r) => /duplicate|already exists|unique constraint/i.test(r),
    build: (raw) => ({
      title: "Dokumen kemungkinan sudah pernah diupload",
      message: "Sistem mendeteksi ada konflik nama file dengan dokumen yang sudah ada di storage.",
      action: "Coba ganti nama file lalu upload ulang, atau cek dulu apakah dokumen ini sudah ada di sistem.",
      detail: raw,
    }),
  },
  {
    // Bug buffer/PDF parsing yang sudah pernah terjadi — kasih pesan spesifik kalau muncul lagi
    test: (r) => /detached arraybuffer|cannot perform construct/i.test(r),
    build: (raw) => ({
      title: "Gagal membaca isi dokumen scan",
      message: "Sistem mengalami kendala teknis saat membaca dan menganalisis dokumen hasil scan ini.",
      action: "Coba upload ulang. Kalau masih gagal, kirim file ini ke admin untuk dicek lebih lanjut.",
      detail: raw,
    }),
  },
  {
    // Gagal download dari storage / file rusak
    test: (r) => /gagal mengunduh file|download.*fail|storage.*not found/i.test(r),
    build: (raw) => ({
      title: "Gagal mengambil file dari storage",
      message: "File sudah terupload, tapi sistem gagal mengambilnya kembali untuk dianalisis — kemungkinan ada gangguan sementara di storage.",
      action: "Coba upload ulang dalam beberapa saat.",
      detail: raw,
    }),
  },
];

const FALLBACK = (raw: string, context?: string): FriendlyError => ({
  title: "Terjadi kendala teknis",
  message: context === "save"
    ? "Sistem mengalami kendala saat menyimpan data dokumen ini."
    : "Sistem mengalami kendala saat memproses dokumen ini.",
  action: "Coba lagi dalam beberapa saat. Kalau masih gagal, kirim screenshot ini ke admin/tim IT supaya bisa dicek lebih lanjut.",
  detail: raw,
});

/**
 * Ubah error apa pun (Error, string, unknown) jadi pesan naratif yang
 * enak dibaca user awam. `context` opsional, dipakai untuk sedikit
 * menyesuaikan kalimat fallback (mis. "upload" vs "save").
 */
export function toFriendlyError(raw: unknown, context?: "upload" | "process" | "save" | "duplicate"): FriendlyError {
  const rawMessage = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : "Unknown error";

  for (const pattern of PATTERNS) {
    if (pattern.test(rawMessage)) return pattern.build(rawMessage);
  }

  return FALLBACK(rawMessage, context);
}
