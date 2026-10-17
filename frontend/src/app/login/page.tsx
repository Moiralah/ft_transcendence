'use client';

import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { SignInCard } from '@/components/signInCard';

// Users and moderators. Admins use /staff ("Sign in as staff").
export default function LoginPage() {
	return (
		<div className="flex flex-col min-h-screen text-slate-800 font-sans">
			<SkipLink />
			<header id="navbar" tabIndex={-1} className="focus:outline-none">
				<Navbar />
			</header>
			<main id="main-content" tabIndex={-1} className="flex flex-1 px-4 focus:outline-none">
				<SignInCard portal="member" />
			</main>
			<footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
				<Footer />
			</footer>
		</div>
	);
}
