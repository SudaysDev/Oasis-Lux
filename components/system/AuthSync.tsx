"use client";

import { useEffect, useTransition } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setProfile } from "@/store";
import { getMyProfile } from "@/app/actions/session";

/** Mirrors the server session into Redux (auth slice) once on mount, site-wide. */
export function AuthSync() {
  const dispatch = useAppDispatch();
  const [, start] = useTransition();

  useEffect(() => {
    start(async () => {
      const profile = await getMyProfile();
      dispatch(setProfile(profile));
    });
  }, [dispatch]);

  return null;
}
