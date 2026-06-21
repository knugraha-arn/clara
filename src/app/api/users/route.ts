import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (adminProfile?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Ambil semua profiles
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !profiles) {
    return NextResponse.json({ error: error?.message || "Failed to fetch" }, { status: 500 });
  }

  // Coba ambil last_sign_in via RPC atau fallback ke null
  let lastSignInMap: Record<string, string | null> = {};
  try {
    const { data: signInData } = await adminSupabase.rpc("get_users_last_sign_in");
    if (signInData) {
      lastSignInMap = Object.fromEntries(
        signInData.map((u: { id: string; last_sign_in_at: string }) => [u.id, u.last_sign_in_at])
      );
    }
  } catch {
    // Fallback — tidak ada last_sign_in
  }

  // Ambil statistik upload & download per user
  const { data: uploadStats } = await supabase
    .from("document_logs").select("user_id").eq("event_type", "uploaded");
  const { data: downloadStats } = await supabase
    .from("document_logs").select("user_id").eq("event_type", "downloaded");

  const uploadCount: Record<string, number> = {};
  (uploadStats || []).forEach((l: { user_id: string }) => {
    uploadCount[l.user_id] = (uploadCount[l.user_id] || 0) + 1;
  });

  const downloadCount: Record<string, number> = {};
  (downloadStats || []).forEach((l: { user_id: string }) => {
    downloadCount[l.user_id] = (downloadCount[l.user_id] || 0) + 1;
  });

  const users = profiles.map((p: {
    id: string; email: string; full_name: string; avatar_url: string | null;
    role: string; is_suspended: boolean; suspended_at: string | null; created_at: string;
  }) => ({
    ...p,
    last_sign_in_at: lastSignInMap[p.id] || null,
    upload_count: uploadCount[p.id] || 0,
    download_count: downloadCount[p.id] || 0,
  }));

  return NextResponse.json({ users });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (adminProfile?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, action, role } = await request.json();

  if (userId === user.id) {
    return NextResponse.json({ error: "Tidak dapat mengubah akun sendiri" }, { status: 400 });
  }

  const { data: targetProfile } = await supabase
    .from("profiles").select("role, full_name, email").eq("id", userId).single();
  if (!targetProfile) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  if (action === "change_role") {
    const validRoles = ["viewer", "auditor", "contributor", "admin", "super_admin"];
    if (!validRoles.includes(role)) return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });

    await supabase.from("profiles").update({ role }).eq("id", userId);

    await adminSupabase.from("document_logs").insert({
      document_id: null,
      document_title: "User: " + targetProfile.email,
      user_id: user.id,
      user_email: user.email || "",
      event_type: "role_changed",
      metadata: { target_user: targetProfile.email, from_role: targetProfile.role, to_role: role },
    });

  } else if (action === "suspend") {
    await supabase.from("profiles").update({
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      suspended_by: user.id,
    }).eq("id", userId);

    await adminSupabase.from("document_logs").insert({
      document_id: null,
      document_title: "User: " + targetProfile.email,
      user_id: user.id,
      user_email: user.email || "",
      event_type: "user_suspended",
      metadata: { target_user: targetProfile.email },
    });

  } else if (action === "unsuspend") {
    await supabase.from("profiles").update({
      is_suspended: false,
      suspended_at: null,
      suspended_by: null,
    }).eq("id", userId);

    await adminSupabase.from("document_logs").insert({
      document_id: null,
      document_title: "User: " + targetProfile.email,
      user_id: user.id,
      user_email: user.email || "",
      event_type: "user_unsuspended",
      metadata: { target_user: targetProfile.email },
    });
  }

  return NextResponse.json({ success: true });
}
