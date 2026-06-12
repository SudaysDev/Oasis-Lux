import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { AiAssistant } from "@/components/ai/AiAssistant";

export const metadata: Metadata = { title: "AI Assistant" };

export default async function AiPage({ searchParams }: { searchParams: Promise<{ chat?: string }> }) {
  const viewer = await requireUser();
  const chat = (await searchParams).chat;
  return (
    <DashboardShell profile={viewer}>
      {/* key remounts the assistant when ?chat= changes → the saved chat actually loads */}
      <AiAssistant key={chat ?? "new"} profile={viewer} initialChatId={chat} />
    </DashboardShell>
  );
}
