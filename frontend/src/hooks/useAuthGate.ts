'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionId, getRole, clearSession } from '@/lib/auth';

export type AuthDecision =
  | { action: 'allow' }
  | { action: 'redirect'; to: string }
  | { action: 'clear-then-allow' };   // for a guest who should sign up

export type AuthGateStatus = 'pending' | 'ready' | 'redirecting';

export interface AuthGateResult {
  status: AuthGateStatus;
  token: string | null;
  role: string | null;
}

/**
 * Runs `decide` once on mount, before the page renders its real content.
 *
 *  - 'pending'     → still deciding (server render + first client frame)
 *  - 'redirecting' → a redirect has been issued; the page should stay
 *                    on a placeholder until the route swaps
 *  - 'ready'       → safe to render; `token` and `role` are resolved
 */
export function useAuthGate(
  decide: (token: string | null, role: string | null) => AuthDecision,
): AuthGateResult {
  const router = useRouter();
  const [status, setStatus] = useState<AuthGateStatus>('pending');
  const [auth, setAuth] = useState<{ token: string | null; role: string | null }>({
    token: null,
    role: null,
  });

  useEffect(() => {
    const token = getSessionId();
    const role = getRole();
    const decision = decide(token, role);

    if (decision.action === 'redirect') {
      setAuth({ token, role });
      setStatus('redirecting');
      router.replace(decision.to);
      return;
    }

    if (decision.action === 'clear-then-allow') {
      clearSession();
      setAuth({ token: null, role: null });
    } else {
      setAuth({ token, role });
    }
    setStatus('ready');

    // `decide` is intentionally not a dependency: pages pass inline
    // functions, and the gate must only run its decision once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return { status, token: auth.token, role: auth.role };
}
