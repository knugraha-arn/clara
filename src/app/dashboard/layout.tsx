import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const userProfile = {
    name: profile?.full_name || user.user_metadata?.full_name || user.email || "User",
    email: user.email || "",
    avatar: profile?.avatar_url || user.user_metadata?.avatar_url || null,
    role: profile?.role || "viewer",
  };

  return <DashboardShell profile={userProfile}>{children}</DashboardShell>;
}
