import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditEventType } from "@/types";

interface LogParams {
  supabase: SupabaseClient;
  documentId?: string;
  documentTitle?: string;
  userId: string;
  userEmail: string;
  userName?: string;
  eventType: AuditEventType;
  metadata?: Record<string, unknown>;
  request?: Request;
}

export async function logEvent({
  supabase,
  documentId,
  documentTitle,
  userId,
  userEmail,
  userName,
  eventType,
  metadata = {},
  request,
}: LogParams) {
  try {
    const ipAddress = request?.headers.get("x-forwarded-for")?.split(",")[0] || null;
    const userAgent = request?.headers.get("user-agent") || null;

    await supabase.from("document_logs").insert({
      document_id: documentId || null,
      document_title: documentTitle || "Unknown",
      user_id: userId,
      user_email: userEmail,
      user_name: userName || null,
      event_type: eventType,
      metadata,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (error) {
    // Log error tidak boleh break main flow
    console.error("[Audit] Log error:", error);
  }
}
