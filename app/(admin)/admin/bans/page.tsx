import type { Metadata } from "next";
import { getAdminBans } from "@/lib/data/admin-bans";
import { BansClient } from "@/components/admin/BansClient";

export const metadata: Metadata = { title: "Black List · Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getAdminBans();
  return <BansClient data={data} />;
}
