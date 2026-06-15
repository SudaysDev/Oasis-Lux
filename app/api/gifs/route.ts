import { NextResponse } from "next/server";

// GIF search proxy (Giphy). Uses GIPHY_API_KEY if set, else Giphy's public
// beta key (rate-limited but keyless — fine for dev; owner can add their own).
const KEY = process.env.GIPHY_API_KEY || "dc6zaTOxFJmzC";

interface GiphyItem {
  id: string;
  images: {
    fixed_height: { url: string };
    fixed_height_small?: { url: string };
    preview_gif?: { url: string };
  };
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const base = q
    ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(q)}&limit=24&rating=pg-13`
    : `https://api.giphy.com/v1/gifs/trending?limit=24&rating=pg-13`;
  try {
    const res = await fetch(`${base}&api_key=${KEY}`, { next: { revalidate: 60 } });
    if (!res.ok) return NextResponse.json({ gifs: [] });
    const json = (await res.json()) as { data: GiphyItem[] };
    const gifs = (json.data ?? []).map((g) => ({
      id: g.id,
      url: g.images.fixed_height.url,
      preview: g.images.fixed_height_small?.url ?? g.images.preview_gif?.url ?? g.images.fixed_height.url,
    }));
    return NextResponse.json({ gifs });
  } catch {
    return NextResponse.json({ gifs: [] });
  }
}
