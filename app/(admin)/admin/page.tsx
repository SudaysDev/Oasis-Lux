import type { Metadata } from "next";
import { getAdminDashboard } from "@/lib/data/admin-stats";
import { DashboardClient } from "@/components/admin/DashboardClient";

export const metadata: Metadata = { title: "Control Room · Admin" };
export const dynamic = "force-dynamic";

export default async function ControlRoomPage() {
  const data = await getAdminDashboard();
  return <DashboardClient data={data} />;
}
