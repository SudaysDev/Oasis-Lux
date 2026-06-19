import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchConversations, fetchPeerMini } from "@/lib/data/messages";
import { DashboardShell } from "@/components/app/DashboardShell";
import { MessagesView } from "@/components/messages/MessagesView";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireUser();
  const { id } = await params;
  const sb = await createClient();
  const [conversations, peer] = await Promise.all([
    fetchConversations(sb, profile.id),
    fetchPeerMini(sb, id),
  ]);
  return (
    <DashboardShell profile={profile} flush>
      <MessagesView meId={profile.id} initial={conversations} activePeerId={id} activePeer={peer ?? undefined} />
    </DashboardShell>
  );
}
