"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Cake, Calendar, Check, Copy, Flag, Link as LinkIcon, MessageSquare, Package, Pencil, ShoppingCart, Star, TrendingUp, Wallet } from "lucide-react";
import { Avatar } from "./Avatar";
import { PlanBadge, VerifiedBadge } from "./Badges";
import { StarRating } from "./StarRating";
import { UserSells } from "./UserSells";
import { ReviewsSection } from "./ReviewsSection";
import { EditProfileModal } from "./EditProfileModal";
import { ReportModal } from "@/components/messages/ReportModal";
import { SOCIAL_ORDER, SOCIAL_META } from "@/lib/auth/shared";
import { SOCIAL_ICONS } from "@/components/auth/BrandIcons";
import { useT } from "@/hooks/useT";
import { formatPrice, formatTjPhone } from "@/lib/utils";
import type { ProfileBundle } from "@/lib/data/profile";
import type { MiniProfile, Profile } from "@/types";

function StatTile({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <Icon className="h-4 w-4 text-accent" />
      <p className="mt-2 text-xl font-black">{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-fg-muted">{label}</p>
    </div>
  );
}

export function ProfileView({ bundle }: { bundle: ProfileBundle }) {
  const { stats, products, reviews, isMe, viewerId } = bundle;
  const { t } = useT();
  const [profile, setProfile] = useState<Profile>(bundle.profile);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);

  const onSaved = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));

  const copyUsername = () => {
    void navigator.clipboard
      .writeText(`@${profile.username}`)
      .then(() => {
        setCopied(true);
        toast.success(t("profile.usernameCopied"));
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Copy failed"));
  };

  const peer: MiniProfile = {
    id: profile.id,
    username: profile.username,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    plan: profile.plan,
    isVerified: profile.isVerified,
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* banner */}
      <div className="relative h-44 w-full overflow-hidden rounded-3xl sm:h-56">
        {profile.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid-mesh h-full w-full bg-gradient-to-br from-accent/25 via-bg-elev to-accent-2/25" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent" />
      </div>

      {/* identity */}
      <div className="relative -mt-12 px-4 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
              <Avatar src={profile.avatarUrl} name={profile.username} size={104} className="ring-4 ring-bg" />
            </motion.div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black sm:text-3xl">{profile.fullName || `@${profile.username}`}</h1>
                {profile.isVerified && <VerifiedBadge className="h-5 w-5" />}
                <PlanBadge plan={profile.plan} />
              </div>
              <button
                type="button"
                onClick={copyUsername}
                title={t("profile.copyUsername")}
                className="group flex items-center gap-1.5 font-mono text-xs text-fg-muted transition hover:text-accent"
              >
                @{profile.username}
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />}
              </button>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                <span className="flex items-center gap-1">
                  <StarRating value={stats.rating} size={13} /> {stats.rating > 0 ? stats.rating.toFixed(1) : "New"}
                  {stats.reviewsCount > 0 && ` · ${stats.reviewsCount} reviews`}
                </span>
                <span className="flex items-center gap-1 capitalize">
                  <span className="h-1 w-1 rounded-full bg-fg-muted" /> {profile.role}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Joined {format(new Date(profile.createdAt), "MMM yyyy")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {isMe ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="neon-border flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
              >
                <Pencil className="h-4 w-4" /> Edit profile
              </button>
            ) : (
              <>
                <Link
                  href={`/messages/${profile.id}`}
                  className="neon-border flex items-center gap-2 rounded-full bg-gradient-to-r from-accent/25 to-accent-2/25 px-5 py-2.5 text-sm font-medium transition hover:from-accent/40 hover:to-accent-2/40"
                >
                  <MessageSquare className="h-4 w-4" /> Message
                </Link>
                <button
                  type="button"
                  onClick={() => setReporting(true)}
                  title={t("profile.report")}
                  className="flex items-center gap-2 rounded-full border border-[var(--panel-border)] px-4 py-2.5 text-sm font-medium text-fg-muted transition hover:border-danger/50 hover:text-danger"
                >
                  <Flag className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("profile.report")}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {profile.bio && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg-muted">{profile.bio}</p>}

        {/* birthday + custom links */}
        {(profile.birthday || profile.links.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {profile.birthday && (
              <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-fg-muted">
                <Cake className="h-3.5 w-3.5 text-accent" />
                {format(new Date(profile.birthday), "d MMMM yyyy")}
              </span>
            )}
            {profile.links.map((l, i) => (
              <a
                key={i}
                href={/^https?:\/\//.test(l.url) ? l.url : `https://${l.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-accent transition hover:neon-border"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                {l.label || l.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            ))}
          </div>
        )}

        {/* socials */}
        {Object.keys(profile.socials).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {SOCIAL_ORDER.filter((k) => profile.socials[k]).map((k) => {
              const meta = SOCIAL_META[k];
              const Icon = SOCIAL_ICONS[k];
              return (
                <span key={k} className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs">
                  <span style={{ color: meta.accent }}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {meta.prefix}
                  {profile.socials[k]}
                </span>
              );
            })}
          </div>
        )}

        {isMe && (
          <p className="mt-3 font-mono text-[11px] text-fg-muted">Private · {formatTjPhone(profile.phone)}</p>
        )}
      </div>

      {/* stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-8 lg:grid-cols-6">
        <StatTile icon={Star} label="Rating" value={stats.rating > 0 ? stats.rating.toFixed(1) : "—"} />
        <StatTile icon={MessageSquare} label="Reviews" value={String(stats.reviewsCount)} />
        <StatTile icon={Package} label="Listings" value={String(stats.listings)} />
        <StatTile icon={TrendingUp} label="Sales" value={String(stats.sales)} />
        <StatTile icon={ShoppingCart} label="Purchases" value={String(stats.purchases)} />
        <StatTile
          icon={Wallet}
          label={isMe ? "Cashback" : "Loyalty"}
          value={isMe ? formatPrice(profile.cashbackBalance) : `${profile.loyaltyPoints} pts`}
        />
      </div>

      <div className="px-4 sm:px-8">
        <UserSells sellerId={profile.id} isMe={isMe} initial={products} />
        <ReviewsSection subjectId={profile.id} initial={reviews} />
      </div>

      {isMe && <EditProfileModal open={editing} onClose={() => setEditing(false)} profile={profile} onSaved={onSaved} />}
      {!isMe && viewerId && (
        <ReportModal open={reporting} onClose={() => setReporting(false)} meId={viewerId} peer={peer} />
      )}
    </div>
  );
}
