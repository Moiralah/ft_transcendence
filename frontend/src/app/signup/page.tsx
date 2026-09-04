'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { supabase } from '@/lib/supabaseClient';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
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
          setTimeout(() => router.push('/login'), 2000);
          return;
        }

        // 3. Send token to backend to get our JWT
        const token = loginData.session?.access_token;
        if (token) {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token }),
          });

          const result = await res.json();
          if (!res.ok) throw new Error(result.message || 'Login failed');

          localStorage.setItem('ft_token', result.accessToken);
          router.push('/dashboard');
        } else {
          throw new Error('No access token received');
        }
      } else {
        // Email confirmation might be required – show message
        setSuccess(true);
        setError('Please check your email to confirm your account before logging in.');
        setTimeout(() => router.push('/login'), 3000);
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
    <header>
      <Navbar />
    </header>
    <main className="flex flex-1">
    <div className="card">
      <h1>Create an Account</h1>
      <form onSubmit={handleSignup}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (min. 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{error}</div>}
      </form>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </div>
    </main>
      <footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
        <Footer/>
      </footer>
    </div>
  );
}