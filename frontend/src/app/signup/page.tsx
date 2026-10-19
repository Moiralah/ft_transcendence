'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
// Imported, not /icon.png: that URL is cached for a year, so a new logo
// would never show. The import gets a content-hashed URL.
import logo from '@/app/icon.png';

import { useAuthGate } from '@/hooks/useAuthGate';
import { AuthGatePlaceholder } from '@/components/AuthGatePlaceholder';

import { supabase } from '@/lib/supabaseClient';
import { exchangeSupabaseToken, isTwoFactorRequired, storeSession, MIN_PASSWORD_LENGTH, getToken, isGuest, clearSession } from '@/lib/auth';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Already signed in — no reason to show the signup form again. A guest's
  // throwaway session is dropped instead, so it can sign up.
//   useEffect(() => {
//     if (isGuest()) clearSession();
//     if (getToken()) {
//       router.replace('/dashboard');
//     }
//   }, [router]);

  const { status } = useAuthGate((token, role) => {
     // A guest's throwaway session is dropped, so they can sign up.
     if (role === 'GUEST') return { action: 'clear-then-allow' };
     // A real logged-in user has no reason to see the signup form.
     if (token) return { action: 'redirect', to: '/dashboard' };
     return { action: 'allow' };
	});

  // Same Google flow as the login page: /consent creates the account on the
  // first Google sign-in, so signing up and logging in are one button.
  const handleGoogleSignup = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/consent`,
      },
    });
    if (error) setError(error.message);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setLoading(true);

    try {
      // 1. Sign up with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw new Error(signUpError.message);

      // 2. If sign-up succeeds, we can auto-login (if email confirmation is disabled)
      // Or we can show a success message and redirect to login.
      // For simplicity, we'll try to sign in immediately to get the token.
      if (data.user) {
        // Attempt to log in with the same credentials
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) {
          // If auto-login fails, redirect to login page with message
          setSuccess(true);
          setError('Account created! Please log in.');
          setTimeout(() => router.replace('/login'), 2000);

		if (status !== 'ready') {
            return <AuthGatePlaceholder redirecting={status === 'redirecting'} />;
          }
		  
          return;
        }

        // 3. Send token to backend to get our JWT
        const token = loginData.session?.access_token;
        if (token) {
          const result = await exchangeSupabaseToken(token);
          // A brand-new account never has 2FA enabled yet, so this is always
          // a normal session — but guard anyway in case of a race with an
          // existing account.
          if (isTwoFactorRequired(result)) {
            setSuccess(true);
            setError('Account created! Please log in.');
            setTimeout(() => router.replace('/login'), 2000);
            return;
          }

          storeSession(result);

          router.replace('/dashboard');
        } else {
          throw new Error('No access token received');
        }
      } else {
        // Email confirmation might be required – show message
        setSuccess(true);
        setError('Please check your email to confirm your account before logging in.');
        setTimeout(() => router.replace('/login'), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen text-slate-800 font-sans">
      <SkipLink />
    <header id="navbar" tabIndex={-1} className="focus:outline-none">
      <Navbar />
    </header>
    <main id="main-content" tabIndex={-1} className="flex flex-1 px-4 focus:outline-none">
      {/* Same card as the login page (components/signInCard.tsx). */}
      <div className="w-full max-w-md mx-auto mt-24 mb-12 self-start bg-white rounded-xl shadow-lg p-8 border-t-4 border-amber-700">
        <div className="flex flex-col items-center gap-2 mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo.src} alt="" width={56} height={56} draggable={false} className="h-14 w-14 select-none" />
          <h1 className="text-2xl font-bold text-slate-900">Create an account</h1>
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-1">
          {/* suppressHydrationWarning: browser extensions (password managers,
              Grammarly, etc.) inject class/style onto these after load, which
              otherwise trips React's hydration diff on a false positive. */}
          <label htmlFor="signup-email" className="text-sm font-medium text-slate-700">Email</label>
          <input id="signup-email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className="!text-base !py-3 !mt-0" suppressHydrationWarning />
          <label htmlFor="signup-password" className="text-sm font-medium text-slate-700 mt-2">Password</label>
          <input id="signup-password" type="password" autoComplete="new-password" required value={password}
            aria-describedby="signup-password-hint"
            onChange={(e) => setPassword(e.target.value)} className="!text-base !py-3 !mt-0" suppressHydrationWarning />
          <p id="signup-password-hint" className="text-xs text-slate-600">At least {MIN_PASSWORD_LENGTH} characters.</p>
          <label htmlFor="signup-confirm" className="text-sm font-medium text-slate-700 mt-2">Confirm password</label>
          <input id="signup-confirm" type="password" autoComplete="new-password" required value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} className="!text-base !py-3 !mt-0" suppressHydrationWarning />
          <button type="submit" disabled={loading} className="mt-4 !py-3 !text-base font-semibold disabled:opacity-60">
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        {error && !success && <div className="error" role="alert">{error}</div>}
        {success && <div className="success" role="status">{error}</div>}

        <div className="flex items-center gap-3 my-4 text-sm text-slate-600" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" />
        </div>
        <button type="button" onClick={handleGoogleSignup}
          className="!py-3 !text-base !bg-white !text-slate-800 border !border-solid !border-slate-300 hover:!bg-slate-50">
          Sign up with Google
        </button>

        <ul className="mt-6 !pl-0 list-none flex flex-col items-center gap-2 text-sm text-slate-700">
          <li><Link href="/login" className="underline">Already have an account? Sign in</Link></li>
        </ul>
      </div>
    </main>
      <footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
        <Footer/>
      </footer>
    </div>
  );
}
