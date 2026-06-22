import type { Metadata } from "next";
import { getAdminConversations } from "@/lib/data/admin-messages";
import { AdminMessagesClient } from "@/components/admin/AdminMessagesClient";

export const metadata: Metadata = { title: "Messages · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const data = await getAdminConversations();
  return <AdminMessagesClient data={data} />;
}
