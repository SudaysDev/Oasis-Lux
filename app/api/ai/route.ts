import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { getCurrentProfile } from "@/lib/auth/session";
import { isPaidPlan } from "@/lib/plans";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // data URLs (data:image/png;base64,....)
}

const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

const SYSTEM = `You are the OASIS LUX AI Concierge — a friendly, sharp shopping assistant for
OASIS LUX, a luxury marketplace in Tajikistan selling perfumes, watches, eyewear, electronics,
phones, accessories, clothing, footwear and more. Prices are in сомонӣ (TJS).
Reply in the user's language (Russian / Tajik / English). Format answers cleanly with Markdown:
short paragraphs, **bold** for key points, and "- " bullet lists when listing things. A few
tasteful emoji are welcome. Be concise but warm.
If the user clearly wants to open a page or run a catalog search, append ONE last line exactly:
ACTION: {"kind":"navigate","page":"/profile"}  or  ACTION: {"kind":"search","query":"iphone 16"}.
Otherwise never output an ACTION line.`;

function dataUrlToPart(dataUrl: string): Part | null {
  const m = dataUrl.match(/^data:((?:image|video)\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m) return null;
  return { inlineData: { mimeType: m[1]!, data: m[2]! } };
}

/** Gemini-backed AI Concierge chat — free for every signed-in user, multimodal. */
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "AI is not configured yet." }, { status: 503 });

  let body: { messages?: ChatMessage[]; model?: "flash" | "pro"; thinking?: "standard" | "extended" };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  // Pro model is a paid feature (we have Pro/Elite subscriptions)
  if (body.model === "pro" && !isPaidPlan(profile.plan)) {
    return Response.json({ error: "OASIS Pro model requires a Pro plan.", upgrade: true }, { status: 402 });
  }
  const modelOrder = body.model === "pro" ? ["gemini-2.5-pro", ...MODELS] : MODELS;
  const extended = body.thinking === "extended";
  const systemInstruction = extended
    ? `${SYSTEM}\n\nThinking mode: EXTENDED. Reason carefully step by step, consider edge cases, and give a thorough, well-structured answer.`
    : SYSTEM;
  const maxOutputTokens = extended ? 2400 : 1200;
  const messages = (body.messages ?? []).filter((m) => m.content?.trim() || m.images?.length).slice(-14);
  if (messages.length === 0) return Response.json({ error: "Empty message" }, { status: 400 });

  const genAI = new GoogleGenerativeAI(key);

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content || "(image)" }] as Part[],
  }));
  const lastMsg = messages[messages.length - 1]!;
  const lastParts: Part[] = [];
  if (lastMsg.content?.trim()) lastParts.push({ text: lastMsg.content });
  for (const img of lastMsg.images ?? []) {
    const part = dataUrlToPart(img);
    if (part) lastParts.push(part);
  }
  if (lastParts.length === 0) lastParts.push({ text: "..." });

  let lastErr: unknown = null;
  for (const modelName of modelOrder) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: { temperature: 0.85, maxOutputTokens },
      });
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastParts);
      let text = result.response.text();

      let action: unknown = null;
      const am = text.match(/ACTION:\s*(\{[\s\S]*\})\s*$/);
      if (am) {
        try {
          action = JSON.parse(am[1]!);
        } catch {}
        text = text.replace(/ACTION:\s*\{[\s\S]*\}\s*$/, "").trim();
      }
      return Response.json({ reply: text, action });
    } catch (e) {
      lastErr = e;
    }
  }
  console.error("AI chat failed:", lastErr);
  return Response.json({ error: "AI is busy right now — try again." }, { status: 502 });
}
