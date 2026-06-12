"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { getBrowserClient } from "@/lib/supabase/client";
import { deleteProduct } from "@/lib/data/profile-mutations";
import { ProductArt } from "@/components/landing/ProductArt";
import { formatPrice } from "@/lib/utils";
import type { ProductCondition, SellerProduct } from "@/types";

const CONDITION_LABEL: Record<ProductCondition, string> = {
  new: "New",
  like_new: "Like new",
  used: "Used",
};

export function UserSells({
  sellerId,
  isMe,
  initial,
}: {
  sellerId: string;
  isMe: boolean;
  initial: SellerProduct[];
}) {
  void sellerId;
  const [products, setProducts] = useState(initial);

  const remove = (id: string) => {
    setProducts((p) => p.filter((x) => x.id !== id));
    void deleteProduct(getBrowserClient(), id).catch(() => {});
    toast.success("Listing removed");
  };

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold sm:text-xl">
          User Sells {products.length > 0 && <span className="text-fg-muted">· {products.length}</span>}
        </h2>
        {isMe && (
          <Link
            href="/sell"
            className="neon-border flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-accent transition hover:bg-accent/10"
          >
            <Plus className="h-4 w-4" /> List an item
          </Link>
        )}
      </div>

      {products.length === 0 ? (
        <div className="card rounded-2xl px-6 py-10 text-center">
          <p className="text-sm text-fg-muted">
            {isMe ? "You're not selling anything yet." : "This user isn't selling anything yet."}
          </p>
          {isMe && (
            <Link href="/sell" className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-accent hover:underline">
              <Plus className="h-3.5 w-3.5" /> List your first item
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {products.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group card relative flex flex-col overflow-hidden rounded-2xl p-4 transition hover:border-accent"
              >
                {isMe && (
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    aria-label="Remove listing"
                    className="glass absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-fg-muted transition hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className="relative mx-auto h-32 w-full overflow-hidden rounded-xl transition-transform duration-500 group-hover:scale-105">
                  {p.images.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <ProductArt type={p.type} uid={`us-${p.id}`} hue={p.hue} className="h-full w-full" />
                  )}
                </div>
                <span className="mt-2 inline-flex w-fit rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">
                  {CONDITION_LABEL[p.condition]}
                </span>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-muted">{p.brand || p.type}</p>
                <h3 className="line-clamp-1 text-sm font-semibold">{p.title}</h3>
                {p.color && <p className="text-xs text-fg-muted">{p.color}</p>}
                <p className="mt-1 text-base font-black">{formatPrice(p.price)}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
