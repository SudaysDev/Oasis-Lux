import "server-only";
import { createClient } from "@/lib/supabase/server";
import { mapProfileRow } from "@/lib/auth/session";
import type {
  MiniProfile,
  Plan,
  ProductCondition,
  Profile,
  ProfileStats,
  SellerProduct,
  UserReview,
  ProductType,
} from "@/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

interface RawMini {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan | null;
  is_verified: boolean | null;
}
interface RawReply {
  id: string;
  body: string;
  created_at: string;
  author: RawMini | RawMini[] | null;
}
interface RawReview {
  id: string;
  rating: number;
  body: string;
  created_at: string;
  author: RawMini | RawMini[] | null;
  likes: { user_id: string }[] | null;
  replies: RawReply[] | null;
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function mapMini(r: RawMini | null): MiniProfile {
  return {
    id: r?.id ?? "",
    username: r?.username ?? "unknown",
    fullName: r?.full_name ?? "",
    avatarUrl: r?.avatar_url ?? undefined,
    plan: r?.plan ?? "free",
    isVerified: r?.is_verified ?? false,
  };
}

function mapProduct(r: ProductRow): SellerProduct {
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

function mapReview(r: RawReview, subjectId: string, viewerId?: string): UserReview {
  const likes = r.likes ?? [];
  return {
    id: r.id,
    subjectId,
    author: mapMini(one(r.author)),
    rating: r.rating,
    body: r.body,
    createdAt: r.created_at,
    likeCount: likes.length,
    likedByMe: viewerId ? likes.some((l) => l.user_id === viewerId) : false,
    replies: (r.replies ?? [])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((rep) => {
        const author = mapMini(one(rep.author));
        return {
          id: rep.id,
          author,
          body: rep.body,
          createdAt: rep.created_at,
          isSubject: author.id === subjectId,
        };
      }),
  };
}

export interface ProfileBundle {
  profile: Profile;
  products: SellerProduct[];
  reviews: UserReview[];
  stats: ProfileStats;
  isMe: boolean;
}

export async function getProfileBundle(
  idOrUsername: string,
  viewerId?: string,
): Promise<ProfileBundle | null> {
  const supabase = await createClient();
  const col = UUID_RE.test(idOrUsername) ? "id" : "username";

  const { data: prow } = await supabase.from("profiles").select("*").eq(col, idOrUsername).maybeSingle();
  if (!prow) return null;
  const profile = mapProfileRow(prow);
  const subjectId = profile.id;

  const [{ data: prods }, { data: revs }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("seller_id", subjectId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_reviews")
      .select(
        "id, rating, body, created_at, author:author_id(id, username, full_name, avatar_url, plan, is_verified), likes:user_review_likes(user_id), replies:user_review_replies(id, body, created_at, author:author_id(id, username, full_name, avatar_url, plan, is_verified))",
      )
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false }),
  ]);

  const products = ((prods ?? []) as ProductRow[]).map(mapProduct);
  const reviews = ((revs ?? []) as unknown as RawReview[]).map((r) => mapReview(r, subjectId, viewerId));

  const reviewsCount = reviews.length;
  const rating = reviewsCount ? reviews.reduce((s, r) => s + r.rating, 0) / reviewsCount : 0;

  const stats: ProfileStats = {
    listings: products.length,
    reviewsCount,
    rating,
    purchases: 0, // real once the orders system lands (no orders yet → 0)
    sales: 0,
  };

  return { profile, products, reviews, stats, isMe: viewerId === subjectId };
}
