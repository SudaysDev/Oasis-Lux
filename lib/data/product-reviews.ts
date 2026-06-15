// Browser-side product-review data layer (RLS scopes every write to the author).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniProfile, Plan, ProductReview } from "@/types";

interface RawMini {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan | null;
  is_verified: boolean | null;
}
interface RawReview {
  id: string;
  product_id: string;
  rating: number;
  body: string;
  photos: string[] | null;
  verified_buyer: boolean;
  created_at: string;
  author: RawMini | RawMini[] | null;
  likes: { user_id: string }[] | null;
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

export async function fetchProductReviews(
  sb: SupabaseClient,
  productId: string,
  viewerId?: string,
): Promise<ProductReview[]> {
  const { data } = await sb
    .from("product_reviews")
    .select(
      "id, product_id, rating, body, photos, verified_buyer, created_at, author:author_id(id, username, full_name, avatar_url, plan, is_verified), likes:product_review_likes(user_id)",
    )
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as RawReview[]).map((r) => {
    const likes = r.likes ?? [];
    return {
      id: r.id,
      productId: r.product_id,
      author: toMini(one(r.author)),
      rating: r.rating,
      body: r.body,
      photos: r.photos ?? [],
      verifiedBuyer: r.verified_buyer,
      createdAt: r.created_at,
      likeCount: likes.length,
      likedByMe: viewerId ? likes.some((l) => l.user_id === viewerId) : false,
    };
  });
}

export async function upsertProductReview(
  sb: SupabaseClient,
  authorId: string,
  productId: string,
  rating: number,
  body: string,
  photos: string[],
): Promise<void> {
  const { error } = await sb
    .from("product_reviews")
    .upsert(
      { author_id: authorId, product_id: productId, rating, body, photos },
      { onConflict: "product_id,author_id" },
    );
  if (error) throw error;
}

export async function deleteProductReview(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("product_reviews").delete().eq("id", id);
  if (error) throw error;
}

export async function setProductReviewLike(
  sb: SupabaseClient,
  reviewId: string,
  userId: string,
  like: boolean,
): Promise<void> {
  if (like) {
    await sb
      .from("product_review_likes")
      .upsert({ review_id: reviewId, user_id: userId }, { onConflict: "review_id,user_id" });
  } else {
    await sb.from("product_review_likes").delete().eq("review_id", reviewId).eq("user_id", userId);
  }
}
