
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function usePresence(id: number | undefined) {
  const [ids, setIds] = useState<Set<number>>(new Set());

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

      setIds(userIds);
    });

    channel.subscribe(async (status, err) => {
      if (status === "SUBSCRIBED") {
        const result = await channel.track({
          id,
          onlineAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  return ids;
}
