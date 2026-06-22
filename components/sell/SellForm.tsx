"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bold, Check, ImagePlus, Italic, List, Loader2, Lock, Smile, Sparkles, Tag, X } from "lucide-react";
import toast from "react-hot-toast";
import { getBrowserClient } from "@/lib/supabase/client";
import { createProduct, uploadMedia } from "@/lib/data/profile-mutations";
import { PRODUCT_BRANDS, SELL_COLORS, hexToHue } from "@/lib/sell-data";
import { ProductArt } from "@/components/landing/ProductArt";
import { ProGate } from "@/components/ai/ProGate";
import { isPaidPlan } from "@/lib/plans";
import { BrandSelect } from "./BrandSelect";
import { CategorySelect } from "./CategorySelect";
import { cn, formatPrice } from "@/lib/utils";
import Link from "next/link";
import type { ProductCondition, ProductType, Profile } from "@/types";

const SIZE_UNITS = ["ml", "g", "pcs", "cm", "kg", "L", "—"] as const;
const EMOJIS = ["✨", "🔥", "💎", "🌿", "🕒", "🕶️", "💧", "👑", "⭐", "🎁", "🚀", "💯", "📱", "👟", "🛋️", "⚡"];
const CONDITIONS: { key: ProductCondition; label: string }[] = [
  { key: "new", label: "New" },
  { key: "like_new", label: "Like new" },
  { key: "used", label: "Used" },
];
const MAX_IMAGES = 4;

type Pic = { file: File; url: string };

/** Map the chosen category tags to a ProductType for the neon preview art + DB enum. */
function deriveType(tags: string[]): ProductType {
  const t = tags.join(" ").toLowerCase();
  if (/watch|часы|smartwatch/.test(t)) return "watch";
  if (/glass|eyewear|sun|очк|оптик/.test(t)) return "glasses";
  return "perfume";
}

export function SellForm({
  profile,
  brands,
  colorOptions,
}: {
  profile: Profile;
  /** Brand list from the DB taxonomy (falls back to the legacy static list). */
  brands?: string[];
  /** Colors from the DB taxonomy (name+hex); hue is derived. */
  colorOptions?: { name: string; hex: string }[];
}) {
  const router = useRouter();
  const paid = isPaidPlan(profile.plan);
  const brandList = brands && brands.length ? brands : PRODUCT_BRANDS;
  const colorList: { name: string; hex: string; hue: number }[] =
    colorOptions && colorOptions.length
      ? colorOptions.map((c) => ({ ...c, hue: hexToHue(c.hex) }))
      : SELL_COLORS;
  const [pics, setPics] = useState<Pic[]>([]);
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [condition, setCondition] = useState<ProductCondition>("new");
  const [colors, setColors] = useState<string[]>([]);
  const [sizeAmount, setSizeAmount] = useState("");
  const [sizeUnit, setSizeUnit] = useState<(typeof SIZE_UNITS)[number]>("ml");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [desc, setDesc] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [gate, setGate] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  const type = deriveType(tags);
  const size = sizeAmount.trim() ? `${sizeAmount.trim()}${sizeUnit === "—" ? "" : ` ${sizeUnit}`}` : "";
  const hue = colorList.find((c) => c.name === colors[0])?.hue ?? 210;

  // rich-text description (contentEditable → real bold / italic, not markdown)
  const syncDesc = () => setDesc(descRef.current?.innerHTML ?? "");
  const exec = (cmd: string) => { descRef.current?.focus(); document.execCommand(cmd); syncDesc(); };
  const insertEmoji = (e: string) => { descRef.current?.focus(); document.execCommand("insertText", false, e); syncDesc(); setEmojiOpen(false); };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).slice(0, MAX_IMAGES - pics.length).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPics((p) => [...p, ...next]);
  };
  const removePic = (url: string) => setPics((p) => p.filter((x) => x.url !== url));
  const toggleColor = (name: string) => setColors((c) => (c.includes(name) ? c.filter((x) => x !== name) : [...c, name]));

  const runAI = async () => {
    if (!paid) return setGate("AI listing generation");
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, type: tags.join(", ") || type, condition, colors: colors.join(", "), notes: title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.title) setTitle(data.title);
      if (data.description && descRef.current) {
        descRef.current.innerText = data.description;
        syncDesc();
      }
      toast.success("AI filled your listing");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI is busy, try again");
    } finally {
      setAiLoading(false);
    }
  };

  const publish = async () => {
    if (!title.trim()) return toast.error("Add a title");
    if (!brand.trim()) return toast.error("Pick a brand");
    if (tags.length === 0) return toast.error("Pick at least one category");
    setPublishing(true);
    try {
      const sb = getBrowserClient();
      const images: string[] = [];
      for (const p of pics) images.push(await uploadMedia(sb, profile.id, p.file, "product"));
      await createProduct(sb, profile.id, {
        title: title.trim(),
        brand: brand.trim(),
        type,
        description: desc.trim(),
        color: colors.join(", ") || undefined,
        size: size.trim() || undefined,
        condition,
        price: Number(price) || 0,
        stock: Math.max(1, Number(stock) || 1),
        hue,
        images,
        category: tags[0],
        tags,
      });
      toast.success("Listing published");
      router.push("/profile");
    } catch {
      toast.error("Could not publish the listing");
      setPublishing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/profile" className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-muted transition hover:text-accent">
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </Link>
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent">
          <Tag className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">Sell an item</h1>
          <p className="text-sm text-fg-muted">List anything on OASIS LUX — pick its categories & tags.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        {/* LEFT — media + live preview */}
        <div className="space-y-5">
          <div className="card rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">Photos · {pics.length}/{MAX_IMAGES}</p>
              <button
                type="button"
                onClick={() => (paid ? toast("AI cover generation — coming soon for Pro") : setGate("AI cover generation"))}
                className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition", paid ? "neon-border text-accent" : "glass text-fg-muted")}
              >
                {paid ? <Sparkles className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                AI cover · Pro
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {pics.map((p) => (
                <div key={p.url} className="group relative aspect-square overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removePic(p.url)} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {pics.length < MAX_IMAGES && (
                <label className="field grid aspect-square cursor-pointer place-items-center rounded-xl text-fg-muted transition hover:text-accent">
                  <div className="flex flex-col items-center gap-1">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px]">Add</span>
                  </div>
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                </label>
              )}
            </div>
            <p className="mt-2 text-[11px] text-fg-muted">No photo? A neon preview is generated for you automatically.</p>
          </div>

          {/* live preview */}
          <div className="card rounded-2xl p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">Live preview</p>
            <div className="glass mx-auto max-w-[220px] rounded-2xl p-4">
              <div className="relative mx-auto h-36 w-full overflow-hidden rounded-xl">
                {pics[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pics[0].url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ProductArt type={type} uid="sell-preview" hue={hue} className="h-full w-full" />
                )}
              </div>
              <span className="mt-2 inline-flex rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">
                {CONDITIONS.find((c) => c.key === condition)?.label}
              </span>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-muted">{brand || tags[0] || "Category"}</p>
              <h3 className="line-clamp-1 text-sm font-semibold">{title || "Your item title"}</h3>
              <p className="mt-1 text-base font-black">{formatPrice(Number(price) || 0)}</p>
            </div>
          </div>

          {/* description — big editor on the left */}
          <div className="card rounded-2xl p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">Description</p>
            <div className="relative">
              <div className="field flex items-center gap-1 rounded-t-xl border-b-0 px-2 py-1.5">
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} aria-label="Bold" className="grid h-7 w-7 place-items-center rounded-lg text-fg-muted transition hover:bg-[var(--panel)] hover:text-fg">
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} aria-label="Italic" className="grid h-7 w-7 place-items-center rounded-lg text-fg-muted transition hover:bg-[var(--panel)] hover:text-fg">
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} aria-label="List" className="grid h-7 w-7 place-items-center rounded-lg text-fg-muted transition hover:bg-[var(--panel)] hover:text-fg">
                  <List className="h-3.5 w-3.5" />
                </button>
                <span className="mx-1 h-4 w-px bg-[var(--panel-border)]" />
                <button type="button" onClick={() => setEmojiOpen((o) => !o)} aria-label="Emoji" className="grid h-7 w-7 place-items-center rounded-lg text-fg-muted transition hover:bg-[var(--panel)] hover:text-fg">
                  <Smile className="h-3.5 w-3.5" />
                </button>
              </div>
              {emojiOpen && (
                <div className="popover absolute right-0 top-10 z-20 grid grid-cols-8 gap-1 rounded-xl p-2">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => insertEmoji(e)} className="grid h-8 w-8 place-items-center rounded-lg text-lg transition hover:bg-[var(--panel)]">
                      {e}
                    </button>
                  ))}
                </div>
              )}
              <div
                ref={descRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncDesc}
                data-placeholder="Notes, authenticity, batch, condition… (use B / I to format)"
                className="rich-editor field min-h-[16rem] w-full rounded-b-xl px-3 py-3 text-sm outline-none"
              />
            </div>
          </div>
        </div>

        {/* RIGHT — details */}
        <div className="card space-y-4 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">Details</p>
            <button type="button" onClick={runAI} disabled={aiLoading} className="neon-border flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/10 disabled:opacity-60">
              {aiLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> AI fill {!paid && <Lock className="h-3 w-3" />}
                </>
              )}
            </button>
          </div>

          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-fg-muted">Title *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. iPhone 16 Pro 256GB" className="field w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
          </label>

          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-fg-muted">Brand *</span>
            <BrandSelect value={brand} onChange={setBrand} options={brandList} />
          </label>

          <div>
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-fg-muted">Categories & tags *</span>
            <CategorySelect value={tags} onChange={setTags} />
          </div>

          <div>
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-fg-muted">Condition</span>
            <div className="flex gap-2">
              {CONDITIONS.map((c) => (
                <button key={c.key} type="button" onClick={() => setCondition(c.key)} className={cn("flex-1 rounded-xl px-3 py-2 text-sm transition", condition === c.key ? "neon-border text-accent" : "field text-fg-muted")}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-fg-muted">
              Colors {colors.length > 0 && <span className="text-accent">· {colors.join(", ")}</span>}
            </span>
            <div className="flex flex-wrap gap-2">
              {colorList.map((c) => {
                const on = colors.includes(c.name);
                return (
                  <button key={c.name} type="button" onClick={() => toggleColor(c.name)} title={c.name} aria-label={c.name} className={cn("relative h-8 w-8 rounded-full border-2 transition hover:scale-110", on ? "border-accent" : "border-transparent")} style={{ background: c.hex }}>
                    {on && <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-fg-muted">Price · TJS</span>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0" className="field w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-fg-muted">Stock</span>
              <input value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="1" className="field w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-fg-muted">
              Size / volume {size && <span className="text-accent">· {size}</span>}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input value={sizeAmount} onChange={(e) => setSizeAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Amount" className="field w-28 rounded-xl px-3 py-2.5 text-sm outline-none" />
              <div className="flex flex-wrap gap-1.5">
                {SIZE_UNITS.map((u) => (
                  <button key={u} type="button" onClick={() => setSizeUnit(u)} className={cn("rounded-lg px-3 py-2 text-sm transition", sizeUnit === u ? "neon-border text-accent" : "field text-fg-muted")}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button type="button" onClick={publish} disabled={publishing} className="neon-border flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent/30 to-accent-2/30 px-6 py-3.5 text-sm font-semibold transition hover:from-accent/45 hover:to-accent-2/45 disabled:opacity-60">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
            {publishing ? "Publishing…" : "Publish listing"}
          </button>
        </div>
      </div>

      <ProGate open={!!gate} onClose={() => setGate(null)} feature={gate ?? "This"} />
    </div>
  );
}
