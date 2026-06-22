import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { SellForm } from "@/components/sell/SellForm";
import { getBrandsList, getColorsList } from "@/lib/data/taxonomy";

export const metadata: Metadata = { title: "Sell an item" };

export default async function SellPage() {
  const profile = await requireUser();
  const [brands, colorOptions] = await Promise.all([getBrandsList(), getColorsList()]);
  return (
    <DashboardShell profile={profile}>
      <SellForm profile={profile} brands={brands} colorOptions={colorOptions} />
    </DashboardShell>
  );
}
