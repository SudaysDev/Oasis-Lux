"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ImagePlus, Loader2, Send, ShieldCheck, ThumbsUp, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { getBrowserClient } from "@/lib/supabase/client";
import { uploadMedia } from "@/lib/data/profile-mutations";
import {
  deleteProductReview,
  fetchProductReviews,
  setProductReviewLike,
  upsertProductReview,
} from "@/lib/data/product-reviews";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/profile/Avatar";
import { PlanBadge, VerifiedBadge } from "@/components/profile/Badges";
import { StarRating } from "@/components/profile/StarRating";
import type { ProductReview } from "@/types";

export function ProductReviews({ productId }: { productId: string }) {
  const { profile } = useAuth();
  const { t } = useT();
  const sb = getBrowserClient();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchProductReviews(sb, productId, profile?.id)
      .then((r) => {
        if (cancelled) return;
        setReviews(r);
        const mine = r.find((x) => x.author.id === profile?.id);
        if (mine) {
          setRating(mine.rating);
          setBody(mine.body);
          setPhotos(mine.photos);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, profile?.id]);

  const mine = reviews.find((r) => r.author.id === profile?.id);

  const onPick = async (files: FileList | null) => {
    if (!files?.length || !profile) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 4 - photos.length)) {
        urls.push(await uploadMedia(sb, profile.id, f, "review"));
      }
      setPhotos((p) => [...p, ...urls].slice(0, 4));
    } catch {
      toast.error(t("rev.uploadFail"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (!profile) return;
    if (rating < 1) return toast.error(t("rev.pickStar"));
    setPosting(true);
    try {
      await upsertProductReview(sb, profile.id, productId, rating, body.trim(), photos);
      setReviews(await fetchProductReviews(sb, productId, profile.id));
      toast.success(mine ? t("rev.updated") : t("rev.posted"));
    } catch {
      toast.error(t("rev.postFail"));
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = (r: ProductReview) => {
    if (!profile) return;
    const like = !r.likedByMe;
    setReviews((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, likedByMe: like, likeCount: x.likeCount + (like ? 1 : -1) } : x)),
    );
    void setProductReviewLike(sb, r.id, profile.id, like).catch(() => {});
  };

  const remove = (r: ProductReview) => {
    setReviews((prev) => prev.filter((x) => x.id !== r.id));
    setRating(0);
    setBody("");
    setPhotos([]);
    void deleteProductReview(sb, r.id).catch(() => {});
  };

  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <section id="reviews" className="mt-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-xl font-bold sm:text-2xl">
          {t("rev.title")} {count > 0 && <span className="text-fg-muted">· {count}</span>}
        </h2>
        {count > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black">{avg.toFixed(1)}</span>
            <div>
              <StarRating value={avg} size={16} />
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                {count} {count > 1 ? t("rev.ratings") : t("rev.rating")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* rating distribution */}
      {count > 0 && (
        <div className="card mb-6 grid gap-1.5 rounded-2xl p-4">
          {dist.map((d) => (
            <div key={d.star} className="flex items-center gap-3 text-xs">
              <span className="w-6 font-mono text-fg-muted">{d.star}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-border)]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
                  initial={{ width: 0 }}
                  animate={{ width: `${count ? (d.n / count) * 100 : 0}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <span className="w-6 text-right font-mono text-fg-muted">{d.n}</span>
            </div>
          ))}
        </div>
      )}

      {/* write a review */}
      {profile ? (
        <div className="glass mb-6 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{mine ? t("rev.updateYours") : t("rev.writeReview")}</p>
            <StarRating value={rating} interactive onChange={setRating} size={24} />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={t("rev.placeholder")}
            className="field mt-3 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
          />

          {photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {photos.map((src) => (
                <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((p) => p.filter((x) => x !== src))}
                    className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => void onPick(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || photos.length >= 4}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-fg-muted transition hover:text-accent disabled:opacity-40"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {t("rev.addPhotos")} {photos.length > 0 && `(${photos.length}/4)`}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={posting}
              className="neon-border flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition hover:bg-accent/10 disabled:opacity-50"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {mine ? t("rev.update") : t("rev.post")}
            </button>
          </div>
        </div>
      ) : null}

      {/* list */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="glass h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : count === 0 ? (
        <p className="glass rounded-2xl px-6 py-10 text-center text-sm text-fg-muted">
          {t("rev.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {reviews.map((r) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass rounded-2xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar src={r.author.avatarUrl} name={r.author.username} size={38} />
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold">{r.author.fullName || `@${r.author.username}`}</span>
                        {r.author.isVerified && <VerifiedBadge className="h-3.5 w-3.5" />}
                        <PlanBadge plan={r.author.plan} />
                        {r.verifiedBuyer && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-success">
                            <ShieldCheck className="h-3 w-3" /> {t("rev.verifiedBuyer")}
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[10px] text-fg-muted">
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <StarRating value={r.rating} size={14} />
                </div>

                {r.body && <p className="mt-2 text-sm leading-relaxed">{r.body}</p>}

                {r.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.photos.map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={src} src={src} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-4 text-xs text-fg-muted">
                  <button
                    type="button"
                    onClick={() => toggleLike(r)}
                    disabled={!profile}
                    className={cn(
                      "flex items-center gap-1.5 transition hover:text-accent disabled:opacity-50",
                      r.likedByMe && "text-accent",
                    )}
                  >
                    <ThumbsUp className={cn("h-4 w-4", r.likedByMe && "fill-accent")} /> {t("rev.helpful")} · {r.likeCount}
                  </button>
                  {r.author.id === profile?.id && (
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      className="flex items-center gap-1.5 transition hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
