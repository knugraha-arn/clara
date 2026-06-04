import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET — list semua user
export async function GET() {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Ambil semua profiles + last_sign_in dari auth.users via admin
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // Ambil auth users untuk last_sign_in_at
  const { data: authUsers } = await adminSupabase.auth.admin.listUsers();
  const authMap = Object.fromEntries(
    (authUsers?.users || []).map(u => [u.id, { last_sign_in_at: u.last_sign_in_at, email: u.email }])
  );

  // Ambil statistik aktivitas per user dari document_logs
  const { data: uploadStats } = await supabase
    .from("document_logs")
    .select("user_id")
    .eq("event_type", "uploaded");

  const { data: downloadStats } = await supabase
    .from("document_logs")
    .select("user_id")
    .eq("event_type", "downloaded");

  const uploadCount: Record<string, number> = {};
  (uploadStats || []).forEach((l: { user_id: string }) => {
    uploadCount[l.user_id] = (uploadCount[l.user_id] || 0) + 1;
  });

  const downloadCount: Record<string, number> = {};
  (downloadStats || []).forEach((l: { user_id: string }) => {
    downloadCount[l.user_id] = (downloadCount[l.user_id] || 0) + 1;
  });

  const users = (profiles || []).map((p: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
    is_suspended: boolean;
    suspended_at: string | null;
    created_at: string;
  }) => ({
    ...p,
    last_sign_in_at: authMap[p.id]?.last_sign_in_at || null,
    upload_count: uploadCount[p.id] || 0,
    download_count: downloadCount[p.id] || 0,
  }));

  return NextResponse.json({ users });
}

// PATCH — update role atau suspend/unsuspend
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = await createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (adminProfile?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, action, role } = await request.json();

  // Super admin tidak bisa modify dirinya sendiri
  if (userId === user.id) {
    return NextResponse.json({ error: "Tidak dapat mengubah akun sendiri" }, { status: 400 });
  }

  const { data: targetProfile } = await supabase.from("profiles").select("role, full_name, email").eq("id", userId).single();
  if (!targetProfile) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  if (action === "change_role") {
    const validRoles = ["auditor", "contributor", "admin", "super_admin"];
    if (!validRoles.includes(role)) return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });

    await supabase.from("profiles").update({ role }).eq("id", userId);

    // Log ke audit trail
    await adminSupabase.from("document_logs").insert({
      document_id: null,
      document_title: `User: ${targetProfile.email}`,
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
      document_title: `User: ${targetProfile.email}`,
      user_id: user.id,
      user_email: user.email || "",
      event_type: "role_changed",
      metadata: { target_user: targetProfile.email, action: "suspended" },
    });

  } else if (action === "unsuspend") {
    await supabase.from("profiles").update({
      is_suspended: false,
      suspended_at: null,
      suspended_by: null,
    }).eq("id", userId);

    await adminSupabase.from("document_logs").insert({
      document_id: null,
      document_title: `User: ${targetProfile.email}`,
      user_id: user.id,
      user_email: user.email || "",
      event_type: "role_changed",
      metadata: { target_user: targetProfile.email, action: "unsuspended" },
    });
  }

  return NextResponse.json({ success: true });
}
