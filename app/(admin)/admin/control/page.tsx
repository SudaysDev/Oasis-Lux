import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const metadata: Metadata = { title: "Full Control · Admin" };

export default function Page() {
  return (
    <AdminPlaceholder
      kicker="Full Control"
      title="Command console"
      blurb="A Minecraft-style admin console with live autocomplete: /ban <user> <duration>, /set_price <product> <value>, /set_zapret <user> for <brand>. Type a slash to summon the grid's full power."
    >
      <div
        className="mt-6 rounded-xl border bg-black/40 p-4 font-mono text-xs"
        style={{ borderColor: "rgba(34,255,136,0.2)" }}
      >
        <p style={{ color: "#22ff88" }}>admin@oasis:~$ /ban durov 7d</p>
        <p className="text-fg-muted">/set_price p_8821 499</p>
        <p className="text-fg-muted">/set_zapret aziz for Dior forever</p>
      </div>
    </AdminPlaceholder>
  );
}
