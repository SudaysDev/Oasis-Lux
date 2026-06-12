// ============================================================================
// OASIS LUX — Domain types (shared across the whole app)
// ============================================================================

export type Locale = "en" | "ru" | "tg";
export type Theme = "dark" | "light";
export type Currency = "TJS" | "USD" | "RUB" | "UZS" | "KZT" | "EUR" | "GBP";

export type Role = "customer" | "seller" | "admin" | "courier";

export type SocialPlatform = "telegram" | "instagram" | "tiktok" | "whatsapp";
export type Socials = Partial<Record<SocialPlatform, string>>;

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
export type ProductType = "perfume" | "watch" | "glasses";

export interface Category {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  parentId?: string | null;
}

/** Selectable variant: perfume volume (ml) or frame/face color, etc. */
export interface ProductVariant {
  id: string;
  type: "volume" | "color" | "material";
  name: string;
  hex?: string; // when type === "color"
  priceDelta: number;
  stock: number;
}

export interface ProductAttributes {
  scentNotes?: string[];
  watchMechanism?: string;
  frameMaterial?: string;
  gender?: "male" | "female" | "unisex";
  [key: string]: unknown;
}

export interface Product {
  id: string;
  sellerId: string;
  title: string;
  slug: string;
  description: string;
  type: ProductType;
  categoryId: string;
  brand: string;
  origin: string;
  basePrice: number;
  currency: Currency;
  stock: number;
  rating: number;
  reviewCount: number;
  images: string[];
  tags: string[];
  variants: ProductVariant[];
  attributes: ProductAttributes;
  discountPercent?: number; // best applicable discount, for badges (0..100)
  isActive: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  text: string;
  photos: string[];
  helpfulCount: number;
  verifiedBuyer: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Cart / Favorites
// ---------------------------------------------------------------------------
export interface CartItem {
  productId: string;
  variantId?: string;
  title: string;
  image: string;
  unitPrice: number;
  variantLabel?: string;
  quantity: number;
}

export interface FavoriteItem {
  productId: string;
  addedAt: string;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export type LoyaltyTier = "Bronze" | "Silver" | "Gold" | "Platinum";
export type Plan = "free" | "pro" | "elite";

export interface Profile {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  bannerUrl?: string;
  phone: string;
  role: Role;
  socials: Socials;
  telegramChatId?: string;
  loyaltyTier: LoyaltyTier;
  loyaltyPoints: number;
  cashbackBalance: number;
  locale: Locale;
  theme: Theme;
  bio?: string;
  plan: Plan;
  isVerified: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Social profile (seller listings, reputation reviews, notifications)
// ---------------------------------------------------------------------------
export type ProductCondition = "new" | "like_new" | "used";

export interface SellerProduct {
  id: string;
  sellerId: string;
  title: string;
  brand: string;
  type: ProductType;
  description: string;
  color?: string;
  condition: ProductCondition;
  price: number;
  currency: Currency;
  stock: number;
  hue: number;
  size?: string;
  images: string[];
  rating: number;
  isActive: boolean;
  createdAt: string;
}

/** Compact author identity embedded in reviews/replies. */
export interface MiniProfile {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  plan: Plan;
  isVerified: boolean;
}

export interface ReviewReply {
  id: string;
  author: MiniProfile;
  body: string;
  createdAt: string;
  isSubject: boolean; // author is the profile owner → "author reply" badge
}

export interface UserReview {
  id: string;
  subjectId: string;
  author: MiniProfile;
  rating: number;
  body: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  replies: ReviewReply[];
}

export interface ProfileStats {
  listings: number;
  reviewsCount: number;
  rating: number; // avg of user_reviews (0 when none)
  purchases: number;
  sales: number;
}

// ---------------------------------------------------------------------------
// Orders / Delivery
// ---------------------------------------------------------------------------
export type OrderStatus =
  | "placed"
  | "processing"
  | "out_for_delivery"
  | "arrived"
  | "fulfilled"
  | "cancelled";

export type TajikRegion =
  | "Dushanbe" | "Khujand" | "Bokhtar" | "Kulob" | "Khorog" | "Istaravshan" | "Tursunzade";

export interface OrderItem {
  productId: string;
  title: string;
  image: string;
  variantLabel?: string;
  quantity: number;
  price: number;
}

export interface Courier {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  vehicle: string;
}

export interface LatLng { lat: number; lng: number; }

export interface Delivery {
  orderId: string;
  courier: Courier;
  status: OrderStatus;
  origin: LatLng;
  destination: LatLng;
  current: LatLng;
  distanceRemainingKm: number;
  etaMinutes: number;
  route: [number, number][]; // GeoJSON [lng, lat][]
}

export interface Order {
  id: string;
  userId: string;
  sellerId: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  currency: Currency;
  promoCode?: string;
  region: TajikRegion;
  address: string;
  delivery?: Delivery;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Promo codes
// ---------------------------------------------------------------------------
export type PromoType = "percent" | "fixed" | "cashback";
export type PromoScope = "all" | "category" | "product";

export interface PromoCode {
  id: string;
  code: string;
  type: PromoType;
  value: number;
  scope: PromoScope;
  scopeRef?: string;
  scopeLabel?: string;
  minOrder?: number;
  maxDiscount?: number;
  expiresAt?: string;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  aiGenerated: boolean;
  locked?: boolean;
  lockProgress?: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export type NotificationType = "order" | "ai" | "system" | "promo" | "message" | "review";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------
export interface Conversation {
  id: string;
  customerId: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar?: string;
  productId?: string;
  lastMessage: string;
  unreadCount: number;
  online: boolean;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  attachments: string[];
  read: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// AI assistant
// ---------------------------------------------------------------------------
export type AiRole = "user" | "assistant";

/** Actions the AI can ask the client to perform (function-calling result). */
export type AiAction =
  | { kind: "navigate"; page: string }
  | { kind: "search"; query: string; filters?: Record<string, string | string[]> }
  | { kind: "recommend"; productIds: string[] };

export interface AiMessage {
  id: string;
  role: AiRole;
  content: string;
  attachments?: string[];
  action?: AiAction;
  createdAt: string;
}
