import type { Metadata } from "next";
import { getAdminOrdersList } from "@/lib/data/admin-orders";
import { OrdersClient } from "@/components/admin/OrdersClient";

export const metadata: Metadata = { title: "Orders · Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getAdminOrdersList();
  return <OrdersClient data={data} />;
}
