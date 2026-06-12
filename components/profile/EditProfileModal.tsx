"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Crown, ImagePlus, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { getBrowserClient } from "@/lib/supabase/client";
import { updateProfile, uploadMedia } from "@/lib/data/profile-mutations";
import { SOCIAL_ORDER, SOCIAL_META } from "@/lib/auth/shared";
import { SOCIAL_ICONS } from "@/components/auth/BrandIcons";
import { Avatar } from "./Avatar";
import { PlanBadge } from "./Badges";
import type { Profile, Socials } from "@/types";

const PLAN_LABEL: Record<Profile["plan"], string> = {
  free: "Free plan",
  pro: "Pro Studio",
  elite: "Elite",
};

export function EditProfileModal({
  open,
  onClose,
  profile,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onSaved: (patch: Partial<Profile>) => void;
}) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [socials, setSocials] = useState<Socials>(profile.socials);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(profile.avatarUrl);
  const [bannerPreview, setBannerPreview] = useState<string | undefined>(profile.bannerUrl);
  const [saving, setSaving] = useState(false);

  const pickAvatar = (f: File | null) => {
    setAvatarFile(f);
    if (f) setAvatarPreview(URL.createObjectURL(f));
  };
  const pickBanner = (f: File | null) => {
    setBannerFile(f);
    if (f) setBannerPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    setSaving(true);
    try {
      const sb = getBrowserClient();
      let avatarUrl = profile.avatarUrl;
      let bannerUrl = profile.bannerUrl;
      if (avatarFile) avatarUrl = await uploadMedia(sb, profile.id, avatarFile, "avatar");
      if (bannerFile) bannerUrl = await uploadMedia(sb, profile.id, bannerFile, "banner");

      const patch = {
        fullName: fullName.trim(),
        bio: bio.trim(),
        socials,
        avatarUrl,
        bannerUrl,
      };
      await updateProfile(sb, profile.id, patch);
      onSaved(patch);
      toast.success("Profile updated");
      onClose();
    } catch {
      toast.error("Could not save the profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-60 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.94, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="popover relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl"
          >
            {/* banner editor */}
            <div className="relative h-32 w-full overflow-hidden rounded-t-2xl bg-gradient-to-br from-accent/30 to-accent-2/30">
              {bannerPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bannerPreview} alt="" className="h-full w-full object-cover" />
              )}
              <label className="glass absolute bottom-3 right-3 flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition hover:neon-border">
                <ImagePlus className="h-3.5 w-3.5" /> Banner
                <input type="file" accept="image/*" hidden onChange={(e) => pickBanner(e.target.files?.[0] ?? null)} />
              </label>
              <button type="button" onClick={onClose} className="glass absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-fg-muted hover:text-fg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-6">
              {/* avatar editor */}
              <div className="-mt-10 mb-4 flex items-end gap-3">
                <div className="relative">
                  <Avatar src={avatarPreview} name={profile.username} size={80} className="ring-4 ring-bg-elev" />
                  <label className="glass absolute -bottom-1 -right-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full transition hover:neon-border">
                    <Camera className="h-3.5 w-3.5" />
                    <input type="file" accept="image/*" hidden onChange={(e) => pickAvatar(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-fg-muted">Full name</span>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="field w-full rounded-xl px-3 py-2 text-sm outline-none" />
              </label>

              <label className="mt-3 block">
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-fg-muted">Bio</span>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="Tell buyers about yourself…" className="field w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none" />
              </label>

              <p className="mb-1.5 mt-4 font-mono text-[10px] uppercase tracking-wider text-fg-muted">Plan</p>
              <div className="field flex items-center justify-between rounded-xl px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm">
                  <Crown className="h-4 w-4 text-accent" />
                  {PLAN_LABEL[profile.plan]}
                  {profile.plan !== "free" && <PlanBadge plan={profile.plan} />}
                </span>
                <Link
                  href="/billing"
                  onClick={onClose}
                  className="neon-border rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-accent transition hover:bg-accent/10"
                >
                  {profile.plan === "free" ? "Upgrade" : "Manage"}
                </Link>
              </div>
              <p className="mt-1.5 text-[11px] text-fg-muted">Plans are managed on the billing page — purchase to unlock Pro / Elite.</p>

              <p className="mb-1.5 mt-4 font-mono text-[10px] uppercase tracking-wider text-fg-muted">Social handles</p>
              <div className="space-y-2">
                {SOCIAL_ORDER.map((k) => {
                  const meta = SOCIAL_META[k];
                  const Icon = SOCIAL_ICONS[k];
                  return (
                    <div key={k} className="field flex items-center gap-2 rounded-xl px-3 py-2">
                      <span className="shrink-0" style={{ color: meta.accent }}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-mono text-xs text-fg-muted">{meta.prefix}</span>
                      <input
                        value={socials[k] ?? ""}
                        onChange={(e) => setSocials((s) => ({ ...s, [k]: e.target.value.trim() || undefined }))}
                        placeholder={meta.placeholder}
                        className="w-full bg-transparent text-sm outline-none"
                      />
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={save} disabled={saving} className="neon-border mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent/25 to-accent-2/25 px-6 py-3 text-sm font-medium transition hover:from-accent/40 hover:to-accent-2/40 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
