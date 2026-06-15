import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchConversations } from "@/lib/data/messages";
import { DashboardShell } from "@/components/app/DashboardShell";
import { MessagesView } from "@/components/messages/MessagesView";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const profile = await requireUser();
  const sb = await createClient();
  const conversations = await fetchConversations(sb, profile.id);
  return (
    <DashboardShell profile={profile}>
      <MessagesView meId={profile.id} initial={conversations} />
    </DashboardShell>
  );
}
