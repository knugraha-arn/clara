import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = {
    name: user.user_metadata?.full_name || user.email || "User",
    email: user.email || "",
    avatar: user.user_metadata?.avatar_url || null,
  };

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}
