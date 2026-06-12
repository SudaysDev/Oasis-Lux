// Demo promo codes (until the admin promo engine + DB lands).
// code -> discount percent applied at checkout.
export const PROMO_CODES: Record<string, number> = {
  LUX10: 10,
  OASIS20: 20,
  WELCOME15: 15,
  VIP30: 30,
  NEON50: 50,
};

export const PROMO_STORAGE_KEY = "oasis-promo";
