import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchReports } from "@/lib/data/reports";
import { ReportsAdmin } from "@/components/admin/ReportsAdmin";

export const metadata: Metadata = { title: "Reports · Admin" };

export default async function AdminReportsPage() {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/home");

  const sb = await createClient();
  const reports = await fetchReports(sb);

  return (
    <div className="mx-auto max-w-4xl">
      <ReportsAdmin initial={reports} />
    </div>
  );
}
