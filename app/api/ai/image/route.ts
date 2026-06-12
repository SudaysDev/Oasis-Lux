import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { getCurrentProfile } from "@/lib/auth/session";

export const runtime = "nodejs";

// Image generation models this key exposes (try in order).
const IMAGE_MODELS = ["gemini-2.5-flash-image", "gemini-3.1-flash-image", "gemini-3-pro-image"];

/** AI image generation — free for signed-in users. Returns a data URL. */
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "AI is not configured yet." }, { status: 503 });

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return Response.json({ error: "Describe the image you want" }, { status: 400 });

  const genAI = new GoogleGenerativeAI(key);
  let quota = false;
  for (const modelName of IMAGE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(
        `High-quality, photorealistic, premium product/marketing image. ${prompt}`,
      );
      const parts: Part[] = result.response.candidates?.[0]?.content?.parts ?? [];
      const img = parts.find((p) => p.inlineData)?.inlineData;
      if (img) return Response.json({ image: `data:${img.mimeType};base64,${img.data}` });
    } catch (e) {
      if (e instanceof Error && /429|quota|billing|paid|rate/i.test(e.message)) quota = true;
    }
  }
  // The free Gemini tier blocks image generation (429 / Imagen is paid-only).
  // Tell the client to use its local stylized fallback so the feature still works.
  return Response.json(
    {
      error: quota
        ? "AI image generation needs a paid Gemini plan — used a stylized local render instead."
        : "Could not generate the image.",
      quota,
    },
    { status: quota ? 429 : 502 },
  );
}
