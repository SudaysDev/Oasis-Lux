import type { Metadata } from "next";
import { getAdminStatistics } from "@/lib/data/admin-stats";
import { StatisticsClient } from "@/components/admin/StatisticsClient";

export const metadata: Metadata = { title: "Statistics · Admin" };
export const dynamic = "force-dynamic";

export default async function StatisticsPage() {
  const data = await getAdminStatistics();
  return <StatisticsClient data={data} />;
}
