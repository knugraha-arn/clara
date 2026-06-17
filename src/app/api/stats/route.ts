import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["super_admin", "admin"].includes(profile?.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. Overview dokumen
  const { data: docs } = await supabase.from("documents").select("id, file_size, category, classification, is_scanned, created_at, status").eq("status", "ready");
  const documents = docs || [];

  const totalDocs = documents.length;
  const totalSizeBytes = documents.reduce((sum, d) => sum + (d.file_size || 0), 0);
  const totalScanned = documents.filter(d => d.is_scanned).length;

  // Per kategori
  const byCategory: Record<string, number> = {};
  documents.forEach(d => { byCategory[d.category] = (byCategory[d.category] || 0) + 1; });

  // Per klasifikasi
  const byClassification: Record<string, number> = {};
  documents.forEach(d => { byClassification[d.classification] = (byClassification[d.classification] || 0) + 1; });

  // Upload per bulan (6 bulan terakhir)
  const uploadByMonth: Record<string, number> = {};
  documents.forEach(d => {
    const month = d.created_at.slice(0, 7); // YYYY-MM
    uploadByMonth[month] = (uploadByMonth[month] || 0) + 1;
  });

  // Expiring soon
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const { data: expiring } = await supabase
    .from("documents")
    .select("id")
    .eq("status", "ready")
    .lte("retention_date", thirtyDaysFromNow.toISOString().split("T")[0])
    .gte("retention_date", new Date().toISOString().split("T")[0]);

  // 2. Aktivitas dari audit logs
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: logs } = await supabase
    .from("document_logs")
    .select("event_type, user_email, user_name, document_id, document_title, created_at, metadata")
    .gte("created_at", thirtyDaysAgo.toISOString());

  const allLogs = logs || [];

  // Top uploaders — semua dokumen yang pernah diupload (tidak dibatasi 30 hari)
  const { data: recentDocs } = await supabase
    .from("documents")
    .select("user_id, profiles(full_name, email)")
    .eq("status", "ready");

  const uploaderMap: Record<string, { name: string; count: number }> = {};
  (recentDocs || []).forEach((d: { user_id: string; profiles: { full_name: string; email: string } | null }) => {
    const key = d.user_id;
    const name = d.profiles?.full_name || d.profiles?.email || "Unknown";
    if (!uploaderMap[key]) uploaderMap[key] = { name, count: 0 };
    uploaderMap[key].count++;
  });
  const topUploaders = Object.values(uploaderMap).sort((a, b) => b.count - a.count).slice(0, 5);

  // Top downloaders
  const downloaderMap: Record<string, { name: string; count: number }> = {};
  allLogs.filter(l => l.event_type === "downloaded").forEach(l => {
    const key = l.user_email;
    if (!downloaderMap[key]) downloaderMap[key] = { name: l.user_name || l.user_email, count: 0 };
    downloaderMap[key].count++;
  });
  const topDownloaders = Object.values(downloaderMap).sort((a, b) => b.count - a.count).slice(0, 5);

  // Top previewed docs
  const previewMap: Record<string, { title: string; count: number }> = {};
  allLogs.filter(l => l.event_type === "downloaded").forEach(l => {
    const key = l.document_id || "";
    if (!previewMap[key]) previewMap[key] = { title: l.document_title || "Unknown", count: 0 };
    previewMap[key].count++;
  });
  const topDocuments = Object.values(previewMap).sort((a, b) => b.count - a.count).slice(0, 5);

  // Aktivitas per hari (30 hari)
  const activityByDay: Record<string, { upload: number; download: number }> = {};
  allLogs.forEach(l => {
    const day = l.created_at.slice(0, 10);
    if (!activityByDay[day]) activityByDay[day] = { upload: 0, download: 0 };
    if (l.event_type === "uploaded") activityByDay[day].upload++;
    if (l.event_type === "downloaded") activityByDay[day].download++;
  });

  // Security — akses dokumen Restricted & Confidential
  const sensitiveAccess = allLogs
    .filter(l => l.event_type === "downloaded" && ["confidential", "restricted"].includes(String(l.metadata?.classification || "")))
    .slice(0, 10)
    .map(l => ({
      user: l.user_name || l.user_email,
      document: l.document_title,
      classification: l.metadata?.classification,
      time: l.created_at,
    }));

  return NextResponse.json({
    overview: {
      totalDocs,
      totalSizeBytes,
      totalScanned,
      expiringCount: expiring?.length || 0,
      byCategory,
      byClassification,
      uploadByMonth,
    },
    activity: {
      topUploaders,
      topDownloaders,
      topDocuments,
      activityByDay,
    },
    security: {
      sensitiveAccess,
    },
  });
}
