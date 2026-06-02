import SearchBar from "@/components/search/SearchBar";

export default function SearchPage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#1A1F2E]">Pencarian Dokumen</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Cari dengan kata kunci spesifik atau deskripsi konseptual — AI akan memahami maksud Anda
        </p>
      </div>
      <SearchBar />
    </div>
  );
}
