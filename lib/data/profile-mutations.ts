// Browser-side profile mutations (RLS scopes every write to the signed-in user).
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppNotification,
  MiniProfile,
  Plan,
  ProductCondition,
  ProductType,
  ProfileLink,
  SellerProduct,
  Socials,
  UserReview,
} from "@/types";

interface ProductRow {
  id: string;
  seller_id: string;
  title: string;
  brand: string;
  type: ProductType;
  description: string;
  color: string | null;
  condition: ProductCondition;
  price: number | string;
  currency: string;
  stock: number;
  hue: number;
  size: string | null;
  images: string[] | null;
  rating: number | string;
  is_active: boolean;
  created_at: string;
}

function mapProductRow(r: ProductRow): SellerProduct {
  return {
    id: r.id,
    sellerId: r.seller_id,
    title: r.title,
    brand: r.brand,
    type: r.type,
    description: r.description,
    color: r.color ?? undefined,
    condition: r.condition,
    price: Number(r.price),
    currency: (r.currency as SellerProduct["currency"]) ?? "TJS",
    stock: r.stock,
    hue: r.hue,
    size: r.size ?? undefined,
    images: r.images ?? [],
    rating: Number(r.rating),
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

// ---- reviews refetch (real ids after a post) -------------------------------
interface RawMini {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan | null;
  is_verified: boolean | null;
}
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const toMini = (r: RawMini | null): MiniProfile => ({
  id: r?.id ?? "",
  username: r?.username ?? "unknown",
  fullName: r?.full_name ?? "",
  avatarUrl: r?.avatar_url ?? undefined,
  plan: r?.plan ?? "free",
  isVerified: r?.is_verified ?? false,
});

export async function fetchReviews(
  sb: SupabaseClient,
  subjectId: string,
  viewerId?: string,
): Promise<UserReview[]> {
  const { data } = await sb
    .from("user_reviews")
    .select(
      "id, rating, body, created_at, author:author_id(id, username, full_name, avatar_url, plan, is_verified), likes:user_review_likes(user_id), replies:user_review_replies(id, body, created_at, author:author_id(id, username, full_name, avatar_url, plan, is_verified))",
    )
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });

  interface RawReply { id: string; body: string; created_at: string; author: RawMini | RawMini[] | null }
  interface RawReview {
    id: string; rating: number; body: string; created_at: string;
    author: RawMini | RawMini[] | null; likes: { user_id: string }[] | null; replies: RawReply[] | null;
  }

  return ((data ?? []) as unknown as RawReview[]).map((r) => {
    const likes = r.likes ?? [];
    return {
      id: r.id,
      subjectId,
      author: toMini(one(r.author)),
      rating: r.rating,
      body: r.body,
      createdAt: r.created_at,
      likeCount: likes.length,
      likedByMe: viewerId ? likes.some((l) => l.user_id === viewerId) : false,
      replies: (r.replies ?? [])
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((rep) => {
          const author = toMini(one(rep.author));
          return { id: rep.id, author, body: rep.body, createdAt: rep.created_at, isSubject: author.id === subjectId };
        }),
    };
  });
}

// ---- profile ---------------------------------------------------------------
export interface ProfileEdit {
  fullName?: string;
  bio?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  socials?: Socials;
  plan?: "free" | "pro" | "elite";
  showPhone?: boolean;
  phone?: string;
  birthday?: string | null;
  links?: ProfileLink[];
}

export async function updateProfile(sb: SupabaseClient, userId: string, e: ProfileEdit): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (e.fullName !== undefined) patch.full_name = e.fullName;
  if (e.bio !== undefined) patch.bio = e.bio;
  if (e.avatarUrl !== undefined) patch.avatar_url = e.avatarUrl;
  if (e.bannerUrl !== undefined) patch.banner_url = e.bannerUrl;
  if (e.socials !== undefined) patch.socials = e.socials;
  if (e.plan !== undefined) patch.plan = e.plan;
  if (e.showPhone !== undefined) patch.show_phone = e.showPhone;
  if (e.phone !== undefined) patch.phone = e.phone;
  if (e.birthday !== undefined) patch.birthday = e.birthday;
  if (e.links !== undefined) patch.links = e.links;
  const { error } = await sb.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

export async function uploadMedia(
  sb: SupabaseClient,
  userId: string,
  file: File,
  kind: string,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}

// ---- products (User Sells) -------------------------------------------------
export interface ProductDraft {
  title: string;
  brand: string;
  type: ProductType;
  description: string;
  color?: string;
  size?: string;
  condition: ProductCondition;
  price: number;
  stock: number;
  hue: number;
  images?: string[];
  category?: string;
  tags?: string[];
}

export async function createProduct(
  sb: SupabaseClient,
  sellerId: string,
  d: ProductDraft,
): Promise<SellerProduct> {
  const { data, error } = await sb
    .from("products")
    .insert({
      seller_id: sellerId,
      title: d.title,
      brand: d.brand,
      type: d.type,
      description: d.description,
      color: d.color ?? null,
      size: d.size ?? null,
      condition: d.condition,
      price: d.price,
      stock: d.stock,
      hue: d.hue,
      images: d.images ?? [],
      category: d.category ?? null,
      tags: d.tags ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  return mapProductRow(data as ProductRow);
}

export async function deleteProduct(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) throw error;
}

// ---- reviews ---------------------------------------------------------------
export async function upsertReview(
  sb: SupabaseClient,
  authorId: string,
  subjectId: string,
  rating: number,
  body: string,
): Promise<void> {
  const { error } = await sb
    .from("user_reviews")
    .upsert({ author_id: authorId, subject_id: subjectId, rating, body }, { onConflict: "subject_id,author_id" });
  if (error) throw error;
}

export async function deleteReview(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("user_reviews").delete().eq("id", id);
  if (error) throw error;
}

export async function setReviewLike(
  sb: SupabaseClient,
  reviewId: string,
  userId: string,
  like: boolean,
): Promise<void> {
  if (like) {
    await sb.from("user_review_likes").upsert({ review_id: reviewId, user_id: userId }, { onConflict: "review_id,user_id" });
  } else {
    await sb.from("user_review_likes").delete().eq("review_id", reviewId).eq("user_id", userId);
  }
}

export async function addReply(
  sb: SupabaseClient,
  reviewId: string,
  authorId: string,
  body: string,
): Promise<void> {
  const { error } = await sb.from("user_review_replies").insert({ review_id: reviewId, author_id: authorId, body });
  if (error) throw error;
}

// ---- notifications ---------------------------------------------------------
interface NotificationRow {
  id: string;
  user_id: string;
  type: AppNotification["type"];
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export async function loadNotifications(sb: SupabaseClient, userId: string): Promise<AppNotification[]> {
  const { data } = await sb
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  return ((data ?? []) as NotificationRow[]).map((r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    data: r.data ?? undefined,
    read: r.read,
    createdAt: r.created_at,
  }));
}

export async function markAllNotificationsRead(sb: SupabaseClient, userId: string): Promise<void> {
  await sb.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
}

export async function markNotificationRead(sb: SupabaseClient, id: string): Promise<void> {
  await sb.from("notifications").update({ read: true }).eq("id", id);
}

/**
 * Resolve where a notification should take the user when tapped.
 *   message → the conversation · review → the reviewed profile/product · order → orders …
 * Returns null when there's nowhere meaningful to go (e.g. plain system note).
 */
export function notificationHref(n: AppNotification): string | null {
  const d = (n.data ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
  switch (n.type) {
    case "message": {
      const conv = str("conversationId");
      return conv ? `/messages/${conv}` : "/messages";
    }
    case "review": {
      const product = str("productId");
      if (product) return `/product/${product}`;
      return "/profile"; // a review of my own profile → my profile (with the review)
    }
    case "order":
      return "/orders";
    case "promo":
      return "/promo";
    default:
      return null;
  }
}
