import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const metadata: Metadata = { title: "Promo Engine · Admin" };

export default function Page() {
  return (
    <AdminPlaceholder
      kicker="Promo Engine"
      title="AI promo patterns"
      blurb="Describe a promo in plain language — “20% off perfumes over 500 сомони until Friday” — and watch the parsed schema build live, then activate it. Per-brand / per-category scope and creator commission included."
    />
  );
}
