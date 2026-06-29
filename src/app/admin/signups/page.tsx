import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { AdminSignupsClient } from "@/components/AdminSignupsClient";

export const dynamic = "force-dynamic";

export default async function AdminSignupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminUser(user)) {
    redirect("/");
  }

  return <AdminSignupsClient />;
}