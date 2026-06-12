"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setProfile } from "@/store";
import type { Profile } from "@/types";

/** Seeds Redux with the server-resolved profile immediately (authed pages). */
export function HydrateAuth({ profile }: { profile: Profile }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setProfile(profile));
  }, [dispatch, profile]);
  return null;
}
