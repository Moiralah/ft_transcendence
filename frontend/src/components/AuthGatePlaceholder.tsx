import { Navbar } from './navbar';
import { Footer } from './footer';
import { SkipLink } from './SkipLink';

/**
 * Shown by any page that uses useAuthGate while the gate is still
 * deciding or a redirect is in flight. Renders the same output on server
 * and client, so no hydration mismatch.
 */
export function AuthGatePlaceholder({ redirecting }: { redirecting: boolean }) {
  return (
    <div className="flex flex-col min-h-screen text-slate-800 font-sans">
      <SkipLink />
      <header id="navbar" tabIndex={-1} className="focus:outline-none">
        <Navbar />
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="flex flex-1 items-center justify-center focus:outline-none"
      >
        <p className="text-slate-600">{redirecting ? 'Redirecting…' : 'Loading…'}</p>
      </main>
      <footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
        <Footer />
      </footer>
    </div>
  );
}
