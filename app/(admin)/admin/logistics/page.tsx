import type { Metadata } from "next";
import { getAdminLogistics } from "@/lib/data/admin-logistics";
import { LogisticsClient } from "@/components/admin/LogisticsClient";

export const metadata: Metadata = { title: "Logistics · Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getAdminLogistics();
  return <LogisticsClient data={data} />;
}
