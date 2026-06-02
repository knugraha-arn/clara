import { FileText, Download, Trash2, Tag } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS, formatDate, formatFileSize, cn } from "@/lib/utils";
import type { Document } from "@/types";

interface DocumentCardProps {
  document: Document;
  onDelete?: (id: string) => void;
}

export default function DocumentCard({ document: doc, onDelete }: DocumentCardProps) {
  const handleDownload = async () => {
    const res = await fetch(`/api/documents/${doc.id}/download`);
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-[#F8F9FB] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-[#0344D8]" />
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="font-semibold text-[#1A1F2E] truncate text-sm">{doc.title}</h3>
            {doc.summary && (
              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{doc.summary}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg hover:bg-blue-50 hover:text-[#0344D8] text-gray-400 transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(doc.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors"
              title="Hapus"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", CATEGORY_COLORS[doc.category])}>
            {CATEGORY_LABELS[doc.category]}
          </span>
          {doc.tags?.slice(0, 2).map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{formatDate(doc.created_at)}</p>
          <p className="text-xs text-gray-300">{formatFileSize(doc.file_size)}</p>
        </div>
      </div>

      {/* AI Confidence bar */}
      {doc.category_confidence > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-0.5">
            <div
              className="bg-[#D1EA2C] h-0.5 rounded-full"
              style={{ width: `${doc.category_confidence * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{Math.round(doc.category_confidence * 100)}% AI</span>
        </div>
      )}
    </div>
  );
}
