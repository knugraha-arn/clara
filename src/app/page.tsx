import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#1A1F2E] flex flex-col items-center justify-center px-6 text-white">
      <div className="max-w-2xl text-center space-y-6">
        {/* Logo */}
        <div className="inline-flex items-center gap-2 bg-[#0344D8] px-4 py-1.5 rounded-full text-sm font-semibold tracking-widest uppercase text-[#D1EA2C]">
          CLARA
        </div>

        <h1 className="text-5xl font-bold leading-tight">
          Kelola Dokumen Lebih Cerdas
          <span className="text-[#D1EA2C]"> dengan AI</span>
        </h1>

        <p className="text-gray-400 text-lg leading-relaxed">
          Upload PDF, biarkan AI membaca isinya, mengkategorikan otomatis, dan temukan dokumen apapun hanya dengan mendeskripsikannya.
        </p>

        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/login"
            className="bg-[#0344D8] hover:bg-[#387EE4] text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Masuk ke CLARA
          </Link>
        </div>

        <p className="text-gray-600 text-sm">
          Correspondence and Library Archive with Repository AI
        </p>
      </div>
    </main>
  );
}
