import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const metadata: Metadata = { title: "Logistics · Admin" };

export default function Page() {
  return (
    <AdminPlaceholder
      kicker="Logistics"
      title="Live deliveries"
      blurb="A 3D Tajikistan map with pulsating courier routes on the left, an active-delivery command list on the right — driver telemetry, ETA timers and direct chat links."
    />
  );
}
