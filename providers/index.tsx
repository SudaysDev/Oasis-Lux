"use client";

import { useState, type ReactNode } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { makeStore, type AppStore } from "@/store";
import { AuthSync } from "@/components/system/AuthSync";
import { StoreSync } from "@/components/system/StoreSync";

export function Providers({ children }: { children: ReactNode }) {
  // Lazy `useState` initializers run exactly once per client — stable across renders
  // without reading a ref during render (keeps the strict react-hooks rules happy).
  const [store] = useState<AppStore>(() => makeStore());
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
      }),
  );

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <AuthSync />
        <StoreSync />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "rgba(8,11,20,0.9)",
              color: "#e6f1ff",
              border: "1px solid rgba(34,211,238,0.2)",
              borderRadius: "0.9rem",
              fontSize: "12px",
              fontFamily: "var(--font-geist-mono, monospace)",
              backdropFilter: "blur(12px)",
            },
          }}
        />
      </QueryClientProvider>
    </ReduxProvider>
  );
}
