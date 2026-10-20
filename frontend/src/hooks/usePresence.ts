"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch, getSessionId } from "@/lib/auth";

// One app-wide presence channel, joined from the root layout (<AppPresence />)
// so a user stays online on every page, the canvas included, not only while the
// dashboard is open. Pages read who's online through usePresence().
let onlineIds = new Set<number>();
const listeners = new Set<(ids: Set<number>) => void>();

function setOnlineIds(ids: Set<number>) {
  onlineIds = ids;
  listeners.forEach((listener) => listener(ids));
}

export function AppPresence() {
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [id, setId] = useState<number | null>(null);

  // The session note has no change event in this tab, so re-read it on
  // each navigation: logging in or out then joins or leaves the channel.
  useEffect(() => setToken(getSessionId()), [pathname]);

  useEffect(() => {
    setId(null);
    if (!token) return;

    let cancelled = false;
    apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/profile/me`, {
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((profile) => {
        if (!cancelled && profile?.id != null) setId(profile.id);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (id == null) return;

    const channel = supabase.channel("app-presence", {
      config: {
        presence: { key: String(id) },
      },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const userIds = new Set<number>();

      for (const [key, metas] of Object.entries(state)) {
        const id = Number(key);

        if (Number.isFinite(id) && metas.length > 0) {
          userIds.add(id);
        }
      }

      setOnlineIds(userIds);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          id,
          onlineAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  return null;
}

export function usePresence() {
  const [ids, setIds] = useState<Set<number>>(onlineIds);

  useEffect(() => {
    listeners.add(setIds);
    setIds(onlineIds);
    return () => {
      listeners.delete(setIds);
    };
  }, []);

  return ids;
}
