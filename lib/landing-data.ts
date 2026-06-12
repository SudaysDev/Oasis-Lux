// Demo content for the landing page (the real catalog DB lands in a later phase).
import type { ProductType } from "@/types";

export type DemoProduct = {
  id: string;
  title: string;
  brand: string;
  type: ProductType;
  price: number; // TJS (сомонӣ), current
  discount?: number; // percent 0..100
  volume?: string; // perfume decants
  rating: number;
  hue: number; // tints the generated ProductArt for variety
  stock: number; // units in stock (0 = out of stock)
  desc?: string; // short product description
  tag?: string;
  image?: string; // real uploaded cover (seller listings); falls back to neon art
  tags?: string[]; // category tags (seller listings)
  colors?: string[]; // available colour variants (seller listings)
  size?: string; // size / volume label, e.g. "100 ml", "XL", "42"
  condition?: "new" | "like_new" | "used";
  createdAt?: string;
  isLive?: boolean; // true = a real DB listing (not demo seed)
};

export const DEMO_PRODUCTS: DemoProduct[] = [
  { id: "p1", title: "Tobacco Vanille", brand: "Tom Ford", type: "perfume", price: 95, volume: "10ml", rating: 4.9, hue: 28, stock: 18, tag: "Bestseller", desc: "Opulent tobacco leaf wrapped in creamy vanilla, tonka and cocoa — a warm, smoky oriental signature." },
  { id: "p2", title: "Aventus", brand: "Creed", type: "perfume", price: 120, discount: 20, volume: "5ml", rating: 4.9, hue: 12, stock: 6, desc: "Iconic fruity-smoky blend of pineapple, birch and musk. Bold, fresh and unmistakably regal." },
  { id: "p3", title: "Naxos · VIP Drop", brand: "Xerjoff", type: "perfume", price: 99, discount: 90, volume: "5ml", rating: 4.8, hue: 300, stock: 3, tag: "Exclusive", desc: "Honeyed tobacco, lavender and vanilla in a Sicilian gourmand masterpiece — limited VIP allocation." },
  { id: "p4", title: "Jazz Club", brand: "Margiela", type: "perfume", price: 70, volume: "10ml", rating: 4.7, hue: 45, stock: 22, desc: "Rum, pink pepper and tobacco evoke a smoky downtown bar. Cozy, boozy and effortlessly cool." },
  { id: "w1", title: "Submariner Hommage", brand: "Oasis Time", type: "watch", price: 1200, discount: 30, rating: 4.6, hue: 190, stock: 4, desc: "316L steel dive-style automatic, 300m rated, ceramic bezel and sapphire crystal. Timeless tool watch." },
  { id: "w2", title: "G-Shock Mudmaster", brand: "Casio", type: "watch", price: 480, rating: 4.7, hue: 95, stock: 12, tag: "Rugged", desc: "Mud- and shock-resistant tactical build with twin sensors. Made to survive anything Tajikistan throws at it." },
  { id: "w3", title: "Tank Solaire", brand: "Cartier Style", type: "watch", price: 950, rating: 4.5, hue: 250, stock: 0, desc: "Art-deco rectangular case with Roman numerals and a leather strap — refined dress elegance." },
  { id: "g1", title: "Aviator Classic", brand: "Ray-Ban", type: "glasses", price: 350, discount: 15, rating: 4.8, hue: 210, stock: 9, desc: "The original teardrop aviator — gold frame, G-15 lenses, 100% UV protection. A genuine icon." },
  { id: "g2", title: "Holbrook Prizm", brand: "Oakley", type: "glasses", price: 420, rating: 4.7, hue: 140, stock: 15, desc: "Sport-luxe frame with Prizm contrast-boosting lenses and impact-grade O-Matter construction." },
  { id: "g3", title: "GG Oversized", brand: "Gucci Style", type: "glasses", price: 690, discount: 50, rating: 4.6, hue: 330, stock: 2, tag: "Trending", desc: "Oversized acetate frame with a bold web accent. Statement eyewear for the front row." },
  { id: "p5", title: "Oud Satin Mood", brand: "Margiela", type: "perfume", price: 88, discount: 35, volume: "10ml", rating: 4.8, hue: 320, stock: 7, desc: "Velvety oud, rose and violet with a satin-soft drydown. Plush, sophisticated and long-lasting." },
  { id: "w4", title: "Royal Oak Neon", brand: "Oasis Time", type: "watch", price: 1450, discount: 25, rating: 4.7, hue: 165, stock: 5, desc: "Octagonal bezel, integrated bracelet and a neon-lume dial. Sport-luxury with a futuristic glow." },
];

export const BRANDS = [
  "TOM FORD", "DIOR", "CREED", "XERJOFF", "MARGIELA", "VERSACE",
  "ROLEX", "CASIO", "CARTIER", "RAY-BAN", "OAKLEY", "GUCCI", "MONTBLANC",
];

export const STATS: { label: string; value: number; suffix?: string }[] = [
  { label: "Decants delivered", value: 18400, suffix: "+" },
  { label: "Premium brands", value: 120, suffix: "+" },
  { label: "Active couriers", value: 48 },
  { label: "Cities covered", value: 14 },
];

export type StepItem = { n: string; title: string; desc: string };
export const STEPS: StepItem[] = [
  { n: "01", title: "Browse", desc: "Filter 100+ params — notes, volume, brand, mechanism, frame — and let the AI find your match." },
  { n: "02", title: "Order", desc: "Pay with a local Alif / Dushanbe City card on a slick 3D checkout. Apply promo codes & cashback." },
  { n: "03", title: "Track", desc: "Watch your courier move across a live 3D map of Tajikistan with real-time km & ETA tickers." },
  { n: "04", title: "Receive", desc: "Instant Telegram + email alerts at every checkpoint. Drop reviews & photos when it arrives." },
];

export type FeatureKey = "tracking" | "ai" | "alerts" | "promo" | "secure" | "lang";
export const FEATURES: { key: FeatureKey; title: string; desc: string }[] = [
  { key: "tracking", title: "Live 3D Tracking", desc: "A rotatable 3D map of Tajikistan with pulsing courier hotspots, precise distance and ETA countdowns." },
  { key: "ai", title: "Gemini AI Concierge", desc: "Ask in plain language or send a photo — it searches, filters and navigates the store for you." },
  { key: "alerts", title: "Instant Alerts", desc: "Sellers get an order ping on Telegram & email the second you check out. In-app too, always." },
  { key: "promo", title: "Promo & Cashback", desc: "Gamified vouchers, milestone-locked coupons, and rainbow discount badges — bigger the deal, louder the glow." },
  { key: "secure", title: "Phone-first Access", desc: "No passwords. Your +992 number is your identity, verified by a one-time token." },
  { key: "lang", title: "Three Languages", desc: "Switch the whole experience between English, Русский and Тоҷикӣ from the navbar or settings." },
];
