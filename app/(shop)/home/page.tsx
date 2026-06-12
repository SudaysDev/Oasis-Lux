import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { HomeDashboard } from "@/components/home/HomeDashboard";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const profile = await requireUser(); // redirects to /login when signed out
  return <HomeDashboard profile={profile} />;
}
