import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/home");
  return <AdminShell profile={profile}>{children}</AdminShell>;
}
