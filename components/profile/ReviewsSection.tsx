"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { CornerDownRight, Heart, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { getBrowserClient } from "@/lib/supabase/client";
import { addReply, deleteReview, fetchReviews, setReviewLike, upsertReview } from "@/lib/data/profile-mutations";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { PlanBadge, VerifiedBadge } from "./Badges";
import { StarRating } from "./StarRating";
import type { MiniProfile, UserReview } from "@/types";

export function ReviewsSection({
  subjectId,
  initial,
}: {
  subjectId: string;
  initial: UserReview[];
}) {
  const { profile } = useAuth();
  const viewer: MiniProfile | null = profile
    ? {
        id: profile.id,
        username: profile.username,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
        plan: profile.plan,
        isVerified: profile.isVerified,
      }
    : null;
  const isMe = viewer?.id === subjectId;

  const [reviews, setReviews] = useState<UserReview[]>(initial);
  const mine = reviews.find((r) => r.author.id === viewer?.id);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? "");
  const [posting, setPosting] = useState(false);

  const sb = getBrowserClient();

  const submitReview = async () => {
    if (!viewer) return;
    if (rating < 1) {
      toast.error("Pick a star rating first");
      return;
    }
    setPosting(true);
    try {
      await upsertReview(sb, viewer.id, subjectId, rating, body.trim());
      setReviews(await fetchReviews(sb, subjectId, viewer.id));
      toast.success(mine ? "Review updated" : "Review posted");
    } catch {
      toast.error("Could not post the review");
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = (r: UserReview) => {
    if (!viewer) return;
    const like = !r.likedByMe;
    setReviews((prev) =>
      prev.map((x) =>
        x.id === r.id ? { ...x, likedByMe: like, likeCount: x.likeCount + (like ? 1 : -1) } : x,
      ),
    );
    void setReviewLike(sb, r.id, viewer.id, like).catch(() => {});
  };

  const removeReview = (r: UserReview) => {
    setReviews((prev) => prev.filter((x) => x.id !== r.id));
    if (r.author.id === viewer?.id) {
      setRating(0);
      setBody("");
    }
    void deleteReview(sb, r.id).catch(() => {});
  };

  const postReply = (reviewId: string, text: string) => {
    if (!viewer || !text.trim()) return;
    const optimistic = {
      id: crypto.randomUUID(),
      author: viewer,
      body: text.trim(),
      createdAt: new Date().toISOString(),
      isSubject: viewer.id === subjectId,
    };
    setReviews((prev) =>
      prev.map((x) => (x.id === reviewId ? { ...x, replies: [...x.replies, optimistic] } : x)),
    );
    void addReply(sb, reviewId, viewer.id, text.trim()).catch(() => {});
  };

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-bold sm:text-xl">Reviews</h2>
        {reviews.length > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-fg-muted">
            <StarRating value={avg} size={14} /> {avg.toFixed(1)} · {reviews.length}
          </span>
        )}
      </div>

      {/* write a review (not on your own profile) */}
      {viewer && !isMe && (
        <div className="glass mb-6 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{mine ? "Update your review" : "Rate this seller"}</p>
            <StarRating value={rating} interactive onChange={setRating} size={22} />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Share your experience…"
            className="glass mt-3 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none transition focus:neon-border"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={submitReview}
              disabled={posting}
              className="neon-border flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition hover:bg-accent/10 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {mine ? "Update" : "Post review"}
            </button>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="glass rounded-2xl px-6 py-10 text-center text-sm text-fg-muted">
          No reviews yet{isMe ? " — your buyers' feedback will appear here." : ". Be the first to review."}
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
                <ReviewHead author={r.author} createdAt={r.createdAt} rating={r.rating} />
                {r.body && <p className="mt-2 text-sm leading-relaxed">{r.body}</p>}

                <div className="mt-3 flex items-center gap-4 text-xs text-fg-muted">
                  <button
                    type="button"
                    onClick={() => toggleLike(r)}
                    className={cn("flex items-center gap-1.5 transition hover:text-danger", r.likedByMe && "text-danger")}
                  >
                    <Heart className={cn("h-4 w-4", r.likedByMe && "fill-danger")} /> {r.likeCount}
                  </button>
                  {r.author.id === viewer?.id && (
                    <button
                      type="button"
                      onClick={() => removeReview(r)}
                      className="flex items-center gap-1.5 transition hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                </div>

                {/* replies */}
                {r.replies.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2 border-l-2 border-[var(--panel-border)] pl-3">
                    {r.replies.map((rep) => (
                      <div key={rep.id} className="flex items-start gap-2">
                        <CornerDownRight className="mt-1 h-3.5 w-3.5 shrink-0 text-fg-muted/50" />
                        <div className={cn("rounded-xl px-3 py-2", rep.isSubject ? "bg-accent/10" : "bg-[var(--panel)]")}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold">{rep.author.fullName || `@${rep.author.username}`}</span>
                            {rep.isSubject && (
                              <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-black">
                                Author
                              </span>
                            )}
                            {rep.author.isVerified && <VerifiedBadge className="h-3 w-3" />}
                            <PlanBadge plan={rep.author.plan} />
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed">{rep.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {viewer && <ReplyForm onSubmit={(t) => postReply(r.id, t)} />}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function ReviewHead({ author, createdAt, rating }: { author: MiniProfile; createdAt: string; rating: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Avatar src={author.avatarUrl} name={author.username} size={36} />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold">{author.fullName || `@${author.username}`}</span>
            {author.isVerified && <VerifiedBadge className="h-3.5 w-3.5" />}
            <PlanBadge plan={author.plan} />
          </div>
          <p className="font-mono text-[10px] text-fg-muted">
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
      <StarRating value={rating} size={14} />
    </div>
  );
}

function ReplyForm({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 font-mono text-[11px] uppercase tracking-wider text-fg-muted transition hover:text-accent"
      >
        Reply
      </button>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSubmit(text);
            setText("");
            setOpen(false);
          }
        }}
        placeholder="Write a reply…"
        autoFocus
        className="glass flex-1 rounded-xl px-3 py-2 text-sm outline-none focus:neon-border"
      />
      <button
        type="button"
        onClick={() => {
          onSubmit(text);
          setText("");
          setOpen(false);
        }}
        className="neon-border grid h-9 w-9 place-items-center rounded-xl text-accent"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
