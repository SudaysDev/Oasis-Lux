"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Mousewheel } from "swiper/modules";
import "swiper/css";
import { ArrowRight, Check, Heart, Loader2, Minus, PiggyBank, Plus, ShoppingBag, Tag, Truck, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useCart } from "@/hooks/useCart";
import { useFavorites } from "@/hooks/useFavorites";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import { useMoney } from "@/hooks/useMoney";
import { usePromo } from "@/hooks/usePromo";
import { useT } from "@/hooks/useT";
import { findPromo, promoCashback, promoDiscount, promoMatchesProduct, promoShort } from "@/lib/promo-codes";
import { cn } from "@/lib/utils";
import { ProductArt } from "@/components/landing/ProductArt";
import { ProductCard } from "@/components/shop/ProductCard";
import type { CartItem } from "@/types";
import type { DemoProduct } from "@/lib/landing-data";

const lineKey = (i: CartItem) => `${i.productId}::${i.variantId ?? ""}`;
const FREE_SHIP_THRESHOLD = 500; // TJS — spend this much for free delivery

/** Square check control. */
function CheckBox({ checked, onClick, label, disabled }: { checked: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
        disabled
          ? "cursor-not-allowed border-[var(--panel-border)] opacity-40"
          : checked
            ? "border-accent bg-accent text-black shadow-[0_0_10px_var(--accent-glow)]"
            : "border-[var(--panel-border)] text-transparent hover:border-accent",
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
    </button>
  );
}

type Confirm = { kind: "one"; item: CartItem } | { kind: "bulk"; count: number } | null;

export const CHECKOUT_SELECTION_KEY = "oasis-checkout";

export function CartView() {
  const router = useRouter();
  const { items, remove, changeQty } = useCart();
  const { has, toggleRaw } = useFavorites();
  const { money } = useMoney();
  const { t } = useT();
  const { products } = useLiveProducts(80);
  const { promo, apply: applyCode, deactivate } = usePromo();

  const byId = useMemo(() => {
    const m = new Map<string, DemoProduct>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  // total units already in the cart per product (stock is shared across variants)
  const qtyByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity);
    return m;
  }, [items]);

  // selection: null = "all selected" (default), else an explicit set of line keys
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [promoInput, setPromoInput] = useState("");
  const [applying, setApplying] = useState(false);

  const stockOf = (i: CartItem) => byId.get(i.productId)?.stock ?? Infinity;
  const isOOS = (i: CartItem) => stockOf(i) <= 0;

  const allKeys = useMemo(() => items.map(lineKey), [items]);
  const selectable = items.filter((i) => !isOOS(i));
  const isSel = (k: string) => (selected === null ? true : selected.has(k));
  const effSel = (i: CartItem) => !isOOS(i) && isSel(lineKey(i));
  const selectedItems = items.filter(effSel);
  const allSelected = selectable.length > 0 && selectable.every((i) => isSel(lineKey(i)));
  const noneSelected = selectedItems.length === 0;

  const toggleOne = (k: string) =>
    setSelected((prev) => {
      const base = prev === null ? new Set(allKeys) : new Set(prev);
      if (base.has(k)) base.delete(k);
      else base.add(k);
      return base;
    });
  const toggleAll = () => setSelected(allSelected ? new Set<string>() : null);

  // summary is computed over the SELECTED, in-stock lines only (Ozon/WB-style)
  const subtotal = selectedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  // promo applies only to matching items (brand/category/product scope), not the whole order
  const promoDef = promo.code ? findPromo(promo.code) : null;
  const applicableSubtotal =
    promoDef && promoDef.scope !== "all"
      ? selectedItems.reduce((s, i) => {
          const p = byId.get(i.productId);
          return p && promoMatchesProduct(promoDef, { id: p.id, brand: p.brand, type: p.type, tags: p.tags })
            ? s + i.unitPrice * i.quantity
            : s;
        }, 0)
      : subtotal;
  const discount = promoDiscount(promoDef, applicableSubtotal);
  const cashback = promoCashback(promoDef, applicableSubtotal);
  const promoNoMatch = Boolean(promo.code && promoDef && promoDef.scope !== "all" && applicableSubtotal === 0);
  const total = Math.max(0, subtotal - discount);
  const selectedUnits = selectedItems.reduce((n, i) => n + i.quantity, 0);
  const count = items.reduce((n, i) => n + i.quantity, 0);

  // how much the buyer saves: per-item discounts + the active promo
  const itemSavings = selectedItems.reduce((s, i) => {
    const d = byId.get(i.productId)?.discount;
    if (!d) return s;
    const old = Math.round(i.unitPrice / (1 - d / 100));
    return s + (old - i.unitPrice) * i.quantity;
  }, 0);
  const totalSaved = itemSavings + discount;

  // free-shipping progress
  const shipProgress = Math.min(1, subtotal / FREE_SHIP_THRESHOLD);
  const shipRemaining = Math.max(0, FREE_SHIP_THRESHOLD - subtotal);
  const freeShip = subtotal >= FREE_SHIP_THRESHOLD && subtotal > 0;

  const applyPromo = () => {
    if (!promoInput.trim()) return;
    setApplying(true);
    setTimeout(() => {
      if (applyCode(promoInput)) setPromoInput("");
      setApplying(false);
    }, 550);
  };

  const removePromo = () => deactivate();

  const saveForLater = (item: CartItem) => {
    if (!has(item.productId)) toggleRaw(item.productId);
    remove(item.productId, item.variantId);
    toast.success(t("cart.movedToast"));
  };

  const doConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "one") {
      remove(confirm.item.productId, confirm.item.variantId);
      toast.success(t("cart.removedToast"));
    } else {
      selectedItems.forEach((i) => remove(i.productId, i.variantId));
      setSelected(null);
      toast.success(t("cart.removedToast"));
    }
    setConfirm(null);
  };

  // ---- empty state ---------------------------------------------------------
  if (items.length === 0) {
    const recs = products.slice(0, 12);
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-black sm:text-4xl">{t("cart.title")}</h1>
        <div className="glass mt-8 grid place-items-center rounded-3xl px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent/10 text-accent">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <p className="mt-4 text-lg font-bold">{t("cart.empty")}</p>
          <p className="mt-1 text-sm text-fg-muted">{t("cart.emptyHint")}</p>
          <Link
            href="/catalog"
            className="neon-border mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
          >
            {t("common.browseCatalog")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {recs.length > 0 && <RecommendationRow title={t("cart.recommended")} products={recs} />}
      </div>
    );
  }

  const recs = products.filter((p) => !items.some((i) => i.productId === p.id)).slice(0, 12);

  // ---- filled cart ---------------------------------------------------------
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-black sm:text-4xl">{t("cart.title")}</h1>
      <p className="mt-1 text-sm text-fg-muted">
        {items.length} {items.length > 1 ? t("cart.items") : t("cart.item")}
        {count !== items.length ? ` · ${count} ${t("cart.units")}` : ""} {t("cart.pending")}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* line items */}
        <div className="flex flex-col gap-3">
          {/* select-all toolbar */}
          <div className="card flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              <CheckBox checked={allSelected} onClick={toggleAll} label={t("cart.selectAll")} disabled={selectable.length === 0} />
              <button type="button" onClick={toggleAll} className="flex items-center gap-2 text-sm font-medium">
                {t("cart.selectAll")}
                <span className="font-mono text-xs text-fg-muted">
                  {selectedItems.length}/{selectable.length}
                </span>
              </button>
            </div>
            <AnimatePresence>
              {!noneSelected && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  onClick={() => setConfirm({ kind: "bulk", count: selectedItems.length })}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-fg-muted transition hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" /> {t("cart.deleteSelected")}
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* free-shipping progress */}
          <div className="card rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Truck className={cn("h-4 w-4", freeShip ? "text-success" : "text-accent")} />
              {freeShip ? (
                <span className="font-medium text-success">{t("cart.freeUnlocked")}</span>
              ) : (
                <span className="text-fg-muted">
                  {t("cart.add")} <span className="font-semibold text-fg">{money(shipRemaining)}</span> {t("cart.addMore")}
                </span>
              )}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--panel-border)]">
              <motion.div
                className={cn("h-full rounded-full", freeShip ? "bg-success" : "bg-gradient-to-r from-accent to-accent-2")}
                initial={false}
                animate={{ width: `${shipProgress * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {items.map((item) => {
              const key = lineKey(item);
              const p = byId.get(item.productId);
              const stock = stockOf(item);
              const oos = isOOS(item);
              const productTotal = qtyByProduct.get(item.productId) ?? item.quantity;
              const atStockCap = productTotal >= stock;
              const sel = effSel(item);
              return (
                <motion.div
                  key={key}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className={cn(
                    "card flex items-center gap-3 rounded-2xl p-3 transition sm:gap-4 sm:p-4",
                    !sel && "opacity-60",
                  )}
                >
                  <CheckBox checked={sel} onClick={() => toggleOne(key)} label={`Select ${item.title}`} disabled={oos} />

                  <Link
                    href={`/product/${item.productId}`}
                    className={cn("relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-bg-elev sm:h-24 sm:w-24", oos && "grayscale")}
                  >
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                    ) : p ? (
                      <ProductArt type={p.type} uid={`cart-${item.productId}`} hue={p.hue} className="h-full w-full p-2" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-fg-muted">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${item.productId}`} className="line-clamp-1 font-semibold transition hover:text-accent">
                      {item.title}
                    </Link>
                    {item.variantLabel && (
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-fg-muted">
                        {t("cart.variant")}: {item.variantLabel}
                      </p>
                    )}
                    {oos ? (
                      <p className="mt-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-danger">{t("common.outOfStock")}</p>
                    ) : (
                      <p className="mt-0.5 text-xs text-fg-muted">{money(item.unitPrice)} {t("cart.each")}</p>
                    )}

                    {/* quantity stepper */}
                    <div className="mt-2.5 inline-flex items-center gap-1 rounded-xl border border-[var(--panel-border)] p-1">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.8 }}
                        onClick={() => changeQty(item.productId, item.quantity - 1, item.variantId)}
                        disabled={item.quantity <= 1 || oos}
                        aria-label="Decrease quantity"
                        className="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-accent/10 disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </motion.button>
                      <span className="w-8 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.8 }}
                        onClick={() => changeQty(item.productId, item.quantity + 1, item.variantId)}
                        disabled={atStockCap || oos}
                        aria-label="Increase quantity"
                        className="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-accent/10 disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </motion.button>
                    </div>
                    {atStockCap && !oos && stock !== Infinity && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-amber-400">{t("cart.maxStock")}</span>
                    )}

                    {/* save for later */}
                    <button
                      type="button"
                      onClick={() => saveForLater(item)}
                      className="mt-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-fg-muted transition hover:text-accent"
                    >
                      <Heart className="h-3.5 w-3.5" /> {t("cart.saveForLater")}
                    </button>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirm({ kind: "one", item })}
                      aria-label="Remove item"
                      className="glass grid h-8 w-8 place-items-center rounded-full text-fg-muted transition hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {!oos && <p className="text-lg font-black text-accent">{money(item.unitPrice * item.quantity)}</p>}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card rounded-2xl p-5">
            <h2 className="text-xl font-bold">{t("cart.summary")}</h2>

            <dl className="mt-5 flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">{t("cart.subtotal")}{selectedUnits > 0 ? ` · ${selectedUnits} ${t("cart.units")}` : ""}</dt>
                <dd className="font-medium tabular-nums">{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">{t("cart.shipping")}</dt>
                <dd className="text-right text-xs">
                  {freeShip ? <span className="font-semibold text-success">{t("cart.free")}</span> : <span className="text-fg-muted">{t("cart.calcCheckout")}</span>}
                </dd>
              </div>
              {promo.code && discount > 0 && (
                <div className="flex justify-between">
                  <dt className="flex items-center gap-1.5 text-fg-muted">
                    {t("cart.discount")}
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-success">
                      {promo.code} {promoShort(promo, money)}
                    </span>
                  </dt>
                  <dd className="font-medium tabular-nums text-success">−{money(discount)}</dd>
                </div>
              )}
              {promo.code && cashback > 0 && (
                <div className="flex justify-between">
                  <dt className="flex items-center gap-1.5 text-fg-muted">
                    {t("cart.cashback")}
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-accent">
                      {promo.code} {promo.value}%
                    </span>
                  </dt>
                  <dd className="font-medium tabular-nums text-accent">+{money(cashback)}</dd>
                </div>
              )}
              {promo.code && promo.scopeLabel && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">{t("cart.validOn")}: {promo.scopeLabel}</p>
              )}
              {promoNoMatch && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
                  {t("cart.noMatch")} {promo.code}
                </p>
              )}
            </dl>

            <div className="mt-5 flex items-end justify-between border-t border-[var(--panel-border)] pt-4">
              <span className="text-lg font-bold">{t("cart.total")}</span>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={total}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-2xl font-black text-accent"
                >
                  {money(total)}
                </motion.span>
              </AnimatePresence>
            </div>

            {totalSaved > 0 && (
              <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-success/10 py-1.5 text-xs font-medium text-success">
                <PiggyBank className="h-4 w-4" /> {t("cart.youSave")} {money(totalSaved)}
              </div>
            )}

            {/* promo field */}
            {promo.code ? (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-success/40 bg-success/5 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm text-success">
                  <Tag className="h-4 w-4" /> {promo.code} {t("cart.applied")}
                </span>
                <button
                  type="button"
                  onClick={removePromo}
                  aria-label="Remove promo"
                  className="grid h-6 w-6 place-items-center rounded-lg text-fg-muted transition hover:text-danger"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                  placeholder={t("cart.promoPlaceholder")}
                  className="field w-full rounded-xl px-3 py-2.5 text-sm uppercase outline-none"
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  disabled={applying || !promoInput.trim()}
                  className="card-strong flex min-w-[72px] items-center justify-center rounded-xl px-3 text-sm font-medium transition hover:text-accent disabled:opacity-50"
                >
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.apply")}
                </button>
              </div>
            )}

            <motion.button
              type="button"
              whileHover={noneSelected ? undefined : { scale: 1.02 }}
              whileTap={noneSelected ? undefined : { scale: 0.98 }}
              disabled={noneSelected}
              onClick={() => {
                if (noneSelected) return;
                try {
                  sessionStorage.setItem(CHECKOUT_SELECTION_KEY, JSON.stringify(selectedItems.map(lineKey)));
                } catch {}
                router.push("/checkout");
              }}
              className={cn(
                "mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition",
                noneSelected
                  ? "cursor-not-allowed bg-[var(--panel)] text-fg-muted"
                  : "bg-gradient-to-r from-accent to-accent-2 text-black shadow-[0_16px_44px_-12px_var(--accent-glow)] hover:brightness-110",
              )}
            >
              {noneSelected ? t("cart.selectToCheckout") : t("cart.proceed")}
              {!noneSelected && <ArrowRight className="h-4 w-4" />}
            </motion.button>
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-fg-muted">
              {t("cart.encrypted")}
            </p>
          </div>
        </div>
      </div>

      {recs.length > 0 && <RecommendationRow title={t("cart.alsoLike")} products={recs} />}

      {/* delete confirmation micro-modal */}
      <AnimatePresence>
        {confirm && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              aria-label="Cancel"
              onClick={() => setConfirm(null)}
              className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="popover relative w-full max-w-sm rounded-2xl p-5"
            >
              <p className="text-base font-bold">
                {confirm.kind === "one" ? t("cart.removeItemQ") : t("cart.removeSelQ")}
              </p>
              <p className="mt-1 line-clamp-1 text-sm text-fg-muted">
                {confirm.kind === "one" ? confirm.item.title : t("cart.cantUndo")}
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="flex-1 rounded-xl border border-[var(--panel-border)] py-2.5 text-sm font-medium transition hover:bg-[var(--panel)]"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={doConfirm}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-danger py-2.5 text-sm font-bold text-white transition hover:brightness-110"
                >
                  <Check className="h-4 w-4" /> {t("common.remove")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RecommendationRow({ title, products }: { title: string; products: DemoProduct[] }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      <Swiper
        modules={[FreeMode, Mousewheel]}
        freeMode
        grabCursor
        mousewheel={{ forceToAxis: true }}
        slidesPerView={1.3}
        spaceBetween={14}
        breakpoints={{ 640: { slidesPerView: 2.3 }, 1024: { slidesPerView: 3.2 }, 1280: { slidesPerView: 4 } }}
        className="oasis-swiper"
      >
        {products.map((p) => (
          <SwiperSlide key={p.id}>
            <ProductCard product={p} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
