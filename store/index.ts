import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CartItem, Currency, Locale, Profile, Theme } from "@/types";
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@/lib/config";

// ---- theme ----------------------------------------------------------------
const themeSlice = createSlice({
  name: "theme",
  initialState: { mode: "dark" as Theme },
  reducers: {
    setTheme: (s, a: PayloadAction<Theme>) => { s.mode = a.payload; },
    toggleTheme: (s) => { s.mode = s.mode === "dark" ? "light" : "dark"; },
  },
});

// ---- locale + currency ----------------------------------------------------
const localeSlice = createSlice({
  name: "locale",
  initialState: { locale: DEFAULT_LOCALE as Locale, currency: DEFAULT_CURRENCY as Currency },
  reducers: {
    setLocale: (s, a: PayloadAction<Locale>) => { s.locale = a.payload; },
    setCurrency: (s, a: PayloadAction<Currency>) => { s.currency = a.payload; },
  },
});

// ---- cart -----------------------------------------------------------------
const sameLine = (a: CartItem, p: { productId: string; variantId?: string }) =>
  a.productId === p.productId && a.variantId === p.variantId;

const cartSlice = createSlice({
  name: "cart",
  initialState: { items: [] as CartItem[] },
  reducers: {
    addToCart: (s, a: PayloadAction<CartItem>) => {
      const found = s.items.find((i) => sameLine(i, a.payload));
      if (found) found.quantity += a.payload.quantity;
      else s.items.push(a.payload);
    },
    removeFromCart: (s, a: PayloadAction<{ productId: string; variantId?: string }>) => {
      s.items = s.items.filter((i) => !sameLine(i, a.payload));
    },
    setQuantity: (s, a: PayloadAction<{ productId: string; variantId?: string; quantity: number }>) => {
      const it = s.items.find((i) => sameLine(i, a.payload));
      if (it) it.quantity = Math.max(1, a.payload.quantity);
    },
    clearCart: (s) => { s.items = []; },
    hydrateCart: (s, a: PayloadAction<CartItem[]>) => { s.items = a.payload; },
  },
});

// ---- favorites ------------------------------------------------------------
const favoritesSlice = createSlice({
  name: "favorites",
  initialState: { ids: [] as string[] },
  reducers: {
    toggleFavorite: (s, a: PayloadAction<string>) => {
      s.ids = s.ids.includes(a.payload) ? s.ids.filter((x) => x !== a.payload) : [...s.ids, a.payload];
    },
    hydrateFavorites: (s, a: PayloadAction<string[]>) => { s.ids = a.payload; },
  },
});

// ---- promo (active promo code, mirrored to localStorage) ------------------
const promoSlice = createSlice({
  name: "promo",
  initialState: { code: null as string | null, discountPercent: 0 },
  reducers: {
    setPromo: (s, a: PayloadAction<{ code: string; discountPercent: number }>) => {
      s.code = a.payload.code;
      s.discountPercent = a.payload.discountPercent;
    },
    clearPromo: (s) => { s.code = null; s.discountPercent = 0; },
  },
});

// ---- ui -------------------------------------------------------------------
const uiSlice = createSlice({
  name: "ui",
  initialState: { sidebarOpen: true, cartOpen: false, commandOpen: false, aiMiniOpen: false },
  reducers: {
    toggleSidebar: (s) => { s.sidebarOpen = !s.sidebarOpen; },
    setSidebarOpen: (s, a: PayloadAction<boolean>) => { s.sidebarOpen = a.payload; },
    setCartOpen: (s, a: PayloadAction<boolean>) => { s.cartOpen = a.payload; },
    setCommandOpen: (s, a: PayloadAction<boolean>) => { s.commandOpen = a.payload; },
    setAiMiniOpen: (s, a: PayloadAction<boolean>) => { s.aiMiniOpen = a.payload; },
  },
});

// ---- auth (client mirror of the session) ----------------------------------
const authSlice = createSlice({
  name: "auth",
  initialState: { profile: null as Profile | null, loading: true },
  reducers: {
    setProfile: (s, a: PayloadAction<Profile | null>) => { s.profile = a.payload; s.loading = false; },
    setAuthLoading: (s, a: PayloadAction<boolean>) => { s.loading = a.payload; },
  },
});

export const { setTheme, toggleTheme } = themeSlice.actions;
export const { setLocale, setCurrency } = localeSlice.actions;
export const { addToCart, removeFromCart, setQuantity, clearCart, hydrateCart } = cartSlice.actions;
export const { toggleFavorite, hydrateFavorites } = favoritesSlice.actions;
export const { setPromo, clearPromo } = promoSlice.actions;
export const { toggleSidebar, setSidebarOpen, setCartOpen, setCommandOpen, setAiMiniOpen } = uiSlice.actions;
export const { setProfile, setAuthLoading } = authSlice.actions;

export const makeStore = () =>
  configureStore({
    reducer: {
      theme: themeSlice.reducer,
      locale: localeSlice.reducer,
      cart: cartSlice.reducer,
      favorites: favoritesSlice.reducer,
      promo: promoSlice.reducer,
      ui: uiSlice.reducer,
      auth: authSlice.reducer,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
