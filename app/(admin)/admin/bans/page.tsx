import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const metadata: Metadata = { title: "Black List · Admin" };

export default function Page() {
  return (
    <AdminPlaceholder
      kicker="Black List"
      title="Bans & restrictions"
      blurb="Temporary or permanent bans, plus granular restrictions: block a user from selling, from buying a specific brand, or from messaging — each with an optional expiry."
    />
  );
}
