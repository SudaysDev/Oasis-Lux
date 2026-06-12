// Client-side AI chat history (per user, localStorage). Mirrors the "saved chats"
// panel from the owner's previous project.

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[]; // data URLs
}

export interface AiChat {
  id: string;
  title: string;
  messages: AiChatMessage[];
  updatedAt: number;
}

const key = (userId: string) => `oasis-ai-chats:${userId}`;

export function loadChats(userId: string): AiChat[] {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as AiChat[];
    return Array.isArray(arr) ? arr.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export function saveChats(userId: string, chats: AiChat[]) {
  try {
    // keep last 30 chats; strip images from history to avoid blowing the quota
    const slim = chats.slice(0, 30).map((c) => ({
      ...c,
      messages: c.messages.map((m) => ({ ...m, images: undefined })),
    }));
    localStorage.setItem(key(userId), JSON.stringify(slim));
  } catch {
    // quota — ignore
  }
}

export function titleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 38 ? `${t.slice(0, 38)}…` : t || "New chat";
}
