// Reference data for the listing/sell flow.

export const PRODUCT_BRANDS: string[] = [
  // perfume
  "Tom Ford", "Dior", "Chanel", "Creed", "Xerjoff", "Maison Margiela", "Versace",
  "Giorgio Armani", "Yves Saint Laurent", "Parfums de Marly", "Initio", "Amouage",
  "Byredo", "Le Labo", "Lattafa", "Tiziana Terenzi", "Kilian", "Mancera",
  // watches
  "Rolex", "Omega", "Patek Philippe", "Audemars Piguet", "Cartier", "Casio",
  "Seiko", "Citizen", "Tissot", "TAG Heuer", "Hublot", "G-Shock",
  // glasses
  "Ray-Ban", "Oakley", "Persol", "Carrera", "Police", "Gucci", "Prada", "Montblanc",
];

export type SellColor = { name: string; hex: string; hue: number };

/** Derive an HSL hue (0–360) from a #rrggbb hex — used when a color comes from
 *  the DB (which stores only name+hex) so the neon preview art still works. */
export function hexToHue(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 210;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 210;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

/** Compute rgb() string from a #rrggbb hex (admin color editor display). */
export function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "rgb(136, 136, 136)";
  const n = parseInt(m[1], 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
}

export const SELL_COLORS: SellColor[] = [
  { name: "Onyx", hex: "#0a0a0a", hue: 220 },
  { name: "Graphite", hex: "#374151", hue: 215 },
  { name: "Silver", hex: "#c0c4cc", hue: 210 },
  { name: "Pearl", hex: "#f1f3f6", hue: 210 },
  { name: "Gold", hex: "#d4af37", hue: 45 },
  { name: "Rose Gold", hex: "#b76e79", hue: 350 },
  { name: "Bronze", hex: "#a16207", hue: 38 },
  { name: "Crimson", hex: "#dc2626", hue: 0 },
  { name: "Coral", hex: "#fb7185", hue: 350 },
  { name: "Amber", hex: "#f59e0b", hue: 38 },
  { name: "Lime", hex: "#84cc16", hue: 84 },
  { name: "Emerald", hex: "#10b981", hue: 160 },
  { name: "Teal", hex: "#14b8a6", hue: 174 },
  { name: "Cyan", hex: "#22d3ee", hue: 190 },
  { name: "Sky", hex: "#38bdf8", hue: 200 },
  { name: "Indigo", hex: "#6366f1", hue: 240 },
  { name: "Violet", hex: "#a855f7", hue: 270 },
  { name: "Magenta", hex: "#ec4899", hue: 330 },
  { name: "Navy", hex: "#1e3a8a", hue: 222 },
  { name: "Forest", hex: "#166534", hue: 145 },
  { name: "White", hex: "#ffffff", hue: 0 },
  { name: "Cream", hex: "#f5e6c8", hue: 42 },
  { name: "Beige", hex: "#d8c3a5", hue: 36 },
  { name: "Khaki", hex: "#78716c", hue: 30 },
  { name: "Olive", hex: "#4d7c0f", hue: 80 },
  { name: "Mint", hex: "#6ee7b7", hue: 152 },
  { name: "Turquoise", hex: "#06b6d4", hue: 188 },
  { name: "Sapphire", hex: "#2563eb", hue: 220 },
  { name: "Royal", hex: "#4338ca", hue: 245 },
  { name: "Purple", hex: "#7c3aed", hue: 270 },
  { name: "Lavender", hex: "#c4b5fd", hue: 260 },
  { name: "Plum", hex: "#86198f", hue: 300 },
  { name: "Burgundy", hex: "#7f1d1d", hue: 0 },
  { name: "Brown", hex: "#78350f", hue: 30 },
  { name: "Chocolate", hex: "#5c4033", hue: 25 },
  { name: "Sand", hex: "#eab308", hue: 48 },
  { name: "Peach", hex: "#fdba74", hue: 28 },
  { name: "Rose", hex: "#f472b6", hue: 330 },
  { name: "Slate", hex: "#64748b", hue: 215 },
  { name: "Steel", hex: "#94a3b8", hue: 210 },
  { name: "Charcoal", hex: "#1f2937", hue: 215 },
];
