import type { Metadata } from "next";
import { getAdminUsersList } from "@/lib/data/admin-users";
import { UsersClient } from "@/components/admin/UsersClient";

export const metadata: Metadata = { title: "Users · Admin" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const data = await getAdminUsersList();
  return <UsersClient data={data} />;
}
