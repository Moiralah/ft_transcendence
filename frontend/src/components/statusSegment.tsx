"use client";

import { useState, useEffect, useContext, createContext } from "react";
import { supabase } from "@/lib/supabaseClient";

const statusSegment = createContext<Set<number>>(new Set());

export const status = () => useContext(statusSegment);

export function StatusSegment({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ids, setIds] = useState<Set<number>>(new Set());

  useEffect(() => {
	let cancel = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function start() {
      const token = localStorage.getItem("ft_token");
      if (!token) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/profile/me`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok || cancel) return;

      const profile = await response.json();
      if (profile?.id == null || cancel) return;

      channel = supabase.channel("status", {
        config: { presence: { key: String(profile.id) } },
      });

      channel.on("presence", { event: "sync" }, () => {
        if (!channel) return;

        const s = new Set<number>();
        for (const [key, meta] of Object.entries(channel.presenceState())) {
          if (meta.length > 0) {
            const id = Number(key);
            if (Number.isFinite(id)) s.add(id);
          }
        }
        setIds(s);
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !cancel && channel) {
          await channel.track({
            profileId: profile.id,
            onlineAt: new Date().toISOString(),
          });
        }
      });
    }

    function stop() {
      const oldChannel = channel;
      setIds(new Set());
	  channel = null;
    
      if (oldChannel) {
        void supabase.removeChannel(oldChannel);
      }
    }

    function handleLogin() {
      void start();
    }

    window.addEventListener("app-login", handleLogin);
	window.addEventListener("app-logout", stop);

    return () => {
	  cancel = true;
	  window.removeEventListener("app-login", handleLogin);
	  window.removeEventListener("app-logout", stop);
      stop();
	};
  }, []);

  return (
    <statusSegment.Provider value={ids}>
      {children}
    </statusSegment.Provider>
  );
}