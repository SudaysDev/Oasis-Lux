import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCurrentProfile } from "@/lib/auth/session";
import { isPaidPlan } from "@/lib/plans";

/** AI copywriter: turns a brief into a polished title + description for a listing. */
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPaidPlan(profile.plan)) {
    return Response.json({ error: "AI listing generation is a Pro feature.", upgrade: true }, { status: 402 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "AI is not configured yet." }, { status: 503 });

  let body: { brand?: string; type?: string; condition?: string; colors?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const { brand = "", type = "perfume", condition = "new", colors = "", notes = "" } = body;
  const prompt = `You are a luxury marketplace copywriter for OASIS LUX (a premium store in Tajikistan selling decant perfumes, watches and glasses).
Write copy for a listing with: brand="${brand}", category="${type}", condition="${condition}", colors="${colors}", seller notes="${notes}".
Return STRICT JSON only: {"title": "<catchy product title, max 6 words, no quotes>", "description": "<2-3 sentence premium, vivid description>"}.`;

  const genAI = new GoogleGenerativeAI(key);
  for (const modelName of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json", temperature: 0.85 },
      });
      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text()) as { title?: string; description?: string };
      return Response.json({ title: parsed.title ?? "", description: parsed.description ?? "" });
    } catch {
      // try the next model name
    }
  }
  return Response.json({ error: "AI generation failed. Fill it in manually." }, { status: 502 });
}
