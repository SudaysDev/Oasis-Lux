import { NextResponse } from "next/server";

// GIF search proxy (Tenor). Uses TENOR_KEY if set, else Tenor's public demo
// key on the legacy v1 endpoint (keyless, rate-limited — fine for dev; the
// owner can drop in their own Tenor / google key via TENOR_KEY any time).
// (Giphy's old public beta key now returns 403 BANNED, so we use Tenor.)
const KEY = process.env.TENOR_KEY || "LIVDSRZULELA";

interface TenorFormat { url: string; preview?: string }
interface TenorResult {
  id: string;
  media?: Record<string, TenorFormat>[];
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const params = `key=${KEY}&limit=24&media_filter=minimal&contentfilter=medium`;
  const base = q
    ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&${params}`
    : `https://g.tenor.com/v1/trending?${params}`;
  try {
    const res = await fetch(base, { next: { revalidate: 60 } });
    if (!res.ok) return NextResponse.json({ gifs: [] });
    const json = (await res.json()) as { results?: TenorResult[] };
    const gifs = (json.results ?? [])
      .map((r) => {
        const m = r.media?.[0] ?? {};
        const full = m.gif ?? m.mediumgif ?? m.tinygif;
        const small = m.tinygif ?? m.nanogif ?? m.gif;
        if (!full?.url) return null;
        return { id: r.id, url: full.url, preview: small?.url ?? full.preview ?? full.url };
      })
      .filter((g): g is { id: string; url: string; preview: string } => g !== null);
    return NextResponse.json({ gifs });
  } catch {
    return NextResponse.json({ gifs: [] });
  }
}
