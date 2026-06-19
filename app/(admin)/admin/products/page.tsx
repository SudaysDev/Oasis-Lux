import type { Metadata } from "next";
import { getAdminInventory } from "@/lib/data/admin-inventory";
import { InventoryClient } from "@/components/admin/InventoryClient";

export const metadata: Metadata = { title: "Inventory · Admin" };
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const data = await getAdminInventory();
  return <InventoryClient data={data} />;
}
