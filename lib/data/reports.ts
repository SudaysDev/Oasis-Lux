// Reports: a user flags another (optionally tied to a conversation). Admins
// read + triage them; a DB trigger notifies admins on every new report.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniProfile, Plan } from "@/types";

export const REPORT_CATEGORIES = [
  { key: "spam", label: "Spam or scam" },
  { key: "harassment", label: "Harassment or bullying" },
  { key: "fraud", label: "Fraud / fake goods" },
  { key: "inappropriate", label: "Inappropriate content" },
  { key: "impersonation", label: "Impersonation" },
  { key: "other", label: "Something else" },
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["key"];
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export interface ReportRecord {
  id: string;
  reporter: MiniProfile;
  reported: MiniProfile;
  conversationId: string | null;
  category: string;
  description: string;
  status: ReportStatus;
  createdAt: string;
}

export async function submitReport(
  sb: SupabaseClient,
  args: {
    reporterId: string;
    reportedId: string;
    category: ReportCategory;
    description: string;
    conversationId?: string | null;
  },
): Promise<void> {
  const { error } = await sb.from("reports").insert({
    reporter_id: args.reporterId,
    reported_id: args.reportedId,
    category: args.category,
    description: args.description,
    conversation_id: args.conversationId ?? null,
  });
  if (error) throw error;
}

interface RawMini {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan | null;
  is_verified: boolean | null;
}
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const toMini = (r: RawMini | null): MiniProfile => ({
  id: r?.id ?? "",
  username: r?.username ?? "unknown",
  fullName: r?.full_name ?? "",
  avatarUrl: r?.avatar_url ?? undefined,
  plan: r?.plan ?? "free",
  isVerified: r?.is_verified ?? false,
});
const MINI = "id, username, full_name, avatar_url, plan, is_verified";

/** Admin view: every report, newest first. RLS lets only admins read all. */
export async function fetchReports(sb: SupabaseClient): Promise<ReportRecord[]> {
  const { data } = await sb
    .from("reports")
    .select(
      `id, conversation_id, category, description, status, created_at,
       reporter:profiles!reporter_id(${MINI}),
       reported:profiles!reported_id(${MINI})`,
    )
    .order("created_at", { ascending: false });

  interface Row {
    id: string; conversation_id: string | null; category: string; description: string;
    status: ReportStatus; created_at: string;
    reporter: RawMini | RawMini[] | null; reported: RawMini | RawMini[] | null;
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    reporter: toMini(one(r.reporter)),
    reported: toMini(one(r.reported)),
    conversationId: r.conversation_id,
    category: r.category,
    description: r.description,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function updateReportStatus(sb: SupabaseClient, id: string, status: ReportStatus): Promise<void> {
  const { error } = await sb.from("reports").update({ status }).eq("id", id);
  if (error) throw error;
}
