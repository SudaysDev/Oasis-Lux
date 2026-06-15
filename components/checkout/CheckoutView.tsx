"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Lock, MapPin, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useAppSelector } from "@/store/hooks";
import { useCart } from "@/hooks/useCart";
import { useMoney } from "@/hooks/useMoney";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchProductSellers } from "@/lib/data/products";
import { regionFee, REGIONS } from "@/lib/data/orders";
import { findPromo, promoDiscount, promoMatchesProduct } from "@/lib/promo-codes";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import { CHECKOUT_SELECTION_KEY } from "@/components/shop/CartView";
import { normalizeTjPhone, formatTjPhone, tjNationalDigits, cn } from "@/lib/utils";
import type { Profile } from "@/types";

type Brand = "alif" | "dc";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

function CardFace({
  brand, number, name, expiry, flipped, cvv,
}: { brand: Brand; number: string; name: string; expiry: string; flipped: boolean; cvv: string }) {
  const digits = onlyDigits(number).slice(0, 16).padEnd(16, "•");
  const groups = [0, 1, 2, 3].map((g) => digits.slice(g * 4, g * 4 + 4));
  const mm = expiry.slice(0, 2);
  const yy = expiry.slice(2, 4);
  const grad = brand === "alif"
    ? "linear-gradient(135deg,#0f9d58,#0b5d3b 70%)"
    : "linear-gradient(135deg,#c81d3b,#1d4ed8 75%)";

  return (
    <div className="relative h-52 w-full" style={{ perspective: 1200 }}>
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
      >
        {/* front */}
        <div
          className="absolute inset-0 flex flex-col justify-between rounded-2xl p-5 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
          style={{ background: grad, backfaceVisibility: "hidden" }}
        >
          <div className="flex items-start justify-between">
            <span className="font-mono text-sm font-bold uppercase tracking-wider">
              {brand === "alif" ? "Alif Bank" : "Dushanbe City"}
            </span>
            <span className="text-xs font-semibold opacity-80">OASIS PAY</span>
          </div>
          <div className="h-9 w-12 rounded-md bg-gradient-to-br from-yellow-200/90 to-yellow-500/80" />
          <div className="flex gap-3 font-mono text-lg tracking-[0.18em] sm:text-xl">
            {groups.map((g, i) => (
              <span key={i}>{g}</span>
            ))}
          </div>
          <div className="flex items-end justify-between font-mono text-xs uppercase">
            <span className="max-w-[60%] truncate tracking-wider">{name || "CARDHOLDER NAME"}</span>
            <span className="tracking-wider">{mm || "MM"}/{yy || "YY"}</span>
          </div>
        </div>

        {/* back */}
        <div
          className="absolute inset-0 flex flex-col rounded-2xl text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
          style={{ background: grad, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="mt-5 h-10 w-full bg-black/70" />
          <div className="mt-4 px-5">
            <div className="flex items-center justify-end gap-2">
              <span className="font-mono text-[10px] uppercase opacity-80">CVV</span>
              <span className={cn("grid h-8 min-w-[56px] place-items-center rounded bg-white px-2 font-mono text-sm text-black transition", flipped && "ring-2 ring-white/80")}>
                {cvv || "•••"}
              </span>
            </div>
            <p className="mt-6 text-right font-mono text-[9px] uppercase opacity-70">
              {brand === "alif" ? "Alif Bank · Tajikistan" : "Dushanbe City Bank"}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function CheckoutView({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { items, remove } = useCart();
  const { money } = useMoney();
  const promo = useAppSelector((s) => s.promo);

  // which cart lines we're paying for (saved by the cart's checkout button)
  const [selKeys] = useState<string[] | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(CHECKOUT_SELECTION_KEY);
      return raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      return null;
    }
  });

  const lines = useMemo(() => {
    if (!selKeys) return items;
    const set = new Set(selKeys);
    return items.filter((i) => set.has(`${i.productId}::${i.variantId ?? ""}`));
  }, [items, selKeys]);

  const { products } = useLiveProducts(80);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // delivery form
  const [fullName, setFullName] = useState(profile.fullName || "");
  const [phone, setPhone] = useState(tjNationalDigits(profile.phone || ""));
  const [region, setRegion] = useState("Dushanbe");
  const [address, setAddress] = useState("");

  // payment
  const [brand, setBrand] = useState<Brand>("alif");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [placing, setPlacing] = useState(false);

  const subtotal = lines.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  // scope the promo to matching items (mirrors the cart + server)
  const promoDef = promo.code ? findPromo(promo.code) : null;
  const applicableSubtotal =
    promoDef && promoDef.scope !== "all"
      ? lines.reduce((s, i) => {
          const p = byId.get(i.productId);
          return p && promoMatchesProduct(promoDef, { id: p.id, brand: p.brand, type: p.type, tags: p.tags })
            ? s + i.unitPrice * i.quantity
            : s;
        }, 0)
      : subtotal;
  const discount = promoDiscount(promoDef, applicableSubtotal);
  const deliveryFee = regionFee(region);
  const total = Math.max(0, subtotal - discount) + deliveryFee;

  const numDigits = onlyDigits(cardNumber);
  const expDigits = onlyDigits(expiry);

  const setCardNumberFmt = (v: string) => {
    const d = onlyDigits(v).slice(0, 16);
    setCardNumber(d.replace(/(.{4})/g, "$1 ").trim());
  };
  const setExpiryFmt = (v: string) => {
    const d = onlyDigits(v).slice(0, 4);
    setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
  };

  const validate = (): string | null => {
    if (!fullName.trim()) return "Enter the recipient name";
    if (!normalizeTjPhone(phone)) return "Enter a valid +992 phone";
    if (!address.trim()) return "Enter the delivery address";
    if (numDigits.length !== 16) return "Enter a 16-digit card number";
    if (!cardName.trim()) return "Enter the cardholder name";
    const mm = Number(expDigits.slice(0, 2));
    if (expDigits.length !== 4 || mm < 1 || mm > 12) return "Enter a valid expiry (MM/YY)";
    if (onlyDigits(cvv).length < 3) return "Enter the CVV";
    return null;
  };

  const placeOrder = async () => {
    const err = validate();
    if (err) return toast.error(err);
    if (lines.length === 0) return toast.error("Nothing to checkout");

    setPlacing(true);
    try {
      const sb = getBrowserClient();
      const sellers = await fetchProductSellers(sb, lines.map((l) => l.productId));
      const distinct = [...new Set(Object.values(sellers))];
      const sellerId = distinct.length === 1 ? distinct[0] : null;

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({
            productId: l.productId,
            title: l.title,
            image: l.image ?? "",
            variantLabel: l.variantLabel,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
          region,
          address,
          fullName,
          phone: normalizeTjPhone(phone),
          cardLast4: numDigits.slice(-4),
          cardBrand: brand === "alif" ? "Alif Bank" : "Dushanbe City",
          promoCode: promo.code ?? undefined,
          sellerId,
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) {
        toast.error(json.error || "Payment failed");
        setPlacing(false);
        return;
      }
      // ordered lines leave the cart; clear the saved selection
      lines.forEach((l) => remove(l.productId, l.variantId));
      try { sessionStorage.removeItem(CHECKOUT_SELECTION_KEY); } catch {}
      toast.success("Payment authorized 🎉");
      router.push(`/order/${json.id}/track`);
    } catch {
      toast.error("Could not reach the payment service");
      setPlacing(false);
    }
  };

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-2xl font-black">Nothing to checkout</p>
        <p className="mt-2 text-sm text-fg-muted">Your cart selection is empty.</p>
        <Link
          href="/cart"
          className="neon-border mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
        >
          Back to cart <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-black sm:text-4xl">Checkout</h1>
      <p className="mt-1 text-sm text-fg-muted">Confirm delivery, pay securely, track in real time.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* LEFT: delivery + payment */}
        <div className="flex flex-col gap-6">
          {/* delivery */}
          <section className="card rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <MapPin className="h-5 w-5 text-accent" /> Delivery
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Daler Qodirov"
                  className="field w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
              </Field>
              <Field label="Phone">
                <input value={formatTjPhone(phone)} onChange={(e) => setPhone(tjNationalDigits(e.target.value))}
                  inputMode="tel" placeholder="+992 90 123 45 67"
                  className="field w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
              </Field>
              <Field label="Region">
                <select value={region} onChange={(e) => setRegion(e.target.value)}
                  className="field w-full rounded-xl px-3 py-2.5 text-sm outline-none">
                  {REGIONS.map((r) => (
                    <option key={r} value={r} className="bg-bg-elev text-fg">{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Address">
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, building, apt"
                  className="field w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
              </Field>
            </div>
          </section>

          {/* payment */}
          <section className="card rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Lock className="h-5 w-5 text-accent" /> Payment
              </h2>
              <div className="flex gap-1.5">
                {(["alif", "dc"] as Brand[]).map((b) => (
                  <button key={b} type="button" onClick={() => setBrand(b)}
                    className={cn("rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition",
                      brand === b ? "neon-border text-accent" : "border border-[var(--panel-border)] text-fg-muted")}>
                    {b === "alif" ? "Alif" : "DC Bank"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <CardFace brand={brand} number={cardNumber} name={cardName} expiry={expiry} flipped={flipped} cvv={onlyDigits(cvv)} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Card number">
                  <input value={cardNumber} onChange={(e) => setCardNumberFmt(e.target.value)} inputMode="numeric"
                    placeholder="0000 0000 0000 0000"
                    className="field w-full rounded-xl px-3 py-2.5 font-mono text-sm outline-none" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Cardholder name">
                  <input value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())}
                    placeholder="DALER QODIROV"
                    className="field w-full rounded-xl px-3 py-2.5 text-sm uppercase outline-none" />
                </Field>
              </div>
              <Field label="Expiry">
                <input value={expiry} onChange={(e) => setExpiryFmt(e.target.value)} inputMode="numeric" placeholder="MM/YY"
                  className="field w-full rounded-xl px-3 py-2.5 font-mono text-sm outline-none" />
              </Field>
              <Field label="CVV">
                <input value={cvv} onChange={(e) => setCvv(onlyDigits(e.target.value).slice(0, 4))}
                  onFocus={() => setFlipped(true)} onBlur={() => setFlipped(false)}
                  inputMode="numeric" placeholder="•••"
                  className="field w-full rounded-xl px-3 py-2.5 font-mono text-sm outline-none" />
              </Field>
            </div>
          </section>
        </div>

        {/* RIGHT: summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card rounded-2xl p-5">
            <h2 className="text-lg font-bold">Order summary</h2>

            <div className="mt-4 flex max-h-56 flex-col gap-3 overflow-y-auto pr-1">
              {lines.map((l) => (
                <div key={`${l.productId}-${l.variantId}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="line-clamp-1 font-medium">{l.title}</span>
                    <span className="font-mono text-[11px] text-fg-muted">
                      ×{l.quantity}{l.variantLabel ? ` · ${l.variantLabel}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{money(l.unitPrice * l.quantity)}</span>
                </div>
              ))}
            </div>

            <dl className="mt-4 flex flex-col gap-2 border-t border-[var(--panel-border)] pt-4 text-sm">
              <Row k="Subtotal" v={money(subtotal)} />
              {discount > 0 && <Row k={`Discount (${promo.code})`} v={`−${money(discount)}`} accent="success" />}
              <Row k={`Delivery · ${region}`} v={money(deliveryFee)} />
            </dl>

            <div className="mt-4 flex items-end justify-between border-t border-[var(--panel-border)] pt-4">
              <span className="text-lg font-bold">Total</span>
              <span className="text-2xl font-black text-accent">{money(total)}</span>
            </div>

            <motion.button
              type="button"
              onClick={placeOrder}
              disabled={placing}
              whileTap={placing ? undefined : { scale: 0.98 }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 py-3.5 text-sm font-bold text-black shadow-[0_16px_44px_-12px_var(--accent-glow)] transition hover:brightness-110 disabled:opacity-70"
            >
              {placing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Authorizing…
                </>
              ) : (
                <>
                  Pay {money(total)} <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-fg-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Cancel free within 15 min
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-fg-muted">{label}</span>
      {children}
    </label>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: "success" }) {
  return (
    <div className="flex justify-between">
      <dt className="text-fg-muted">{k}</dt>
      <dd className={cn("tabular-nums", accent === "success" ? "font-medium text-success" : "font-medium")}>{v}</dd>
    </div>
  );
}
