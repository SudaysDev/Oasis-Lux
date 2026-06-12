"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchActiveProducts } from "@/lib/data/products";
import { DEMO_PRODUCTS, type DemoProduct } from "@/lib/landing-data";

/**
 * Real seller listings merged in front of the demo seed, so a user's own
 * published items show up on home / catalog / search immediately.
 */
export function useLiveProducts(limit = 60): { products: DemoProduct[]; live: DemoProduct[]; loading: boolean } {
  const [live, setLive] = useState<DemoProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchActiveProducts(getBrowserClient(), limit)
      .then((p) => { if (!cancelled) setLive(p); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [limit]);

  return { products: [...live, ...DEMO_PRODUCTS], live, loading };
}
