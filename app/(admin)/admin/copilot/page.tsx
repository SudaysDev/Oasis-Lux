import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const metadata: Metadata = { title: "Admin Copilot · Admin" };

export default function Page() {
  return (
    <AdminPlaceholder
      kicker="Admin Copilot"
      title="The smartest AI in the grid"
      blurb="An admin-only copilot that reads logs, runs the panel tour, and executes on command — “make a 30% cashback promo for watches” and it builds + activates it. Accepts images too."
    />
  );
}
