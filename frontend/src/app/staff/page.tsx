'use client';

import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { SignInCard } from '@/components/signInCard';

// "Sign in as staff": admins only. Users and moderators use /login.
export default function StaffLoginPage() {
	return (
		<div className="flex flex-col min-h-screen text-slate-800 font-sans">
			<SkipLink />
			<header id="navbar" tabIndex={-1} className="focus:outline-none">
				<Navbar />
			</header>
			<main id="main-content" tabIndex={-1} className="flex flex-1 px-4 focus:outline-none">
				<SignInCard portal="staff" />
			</main>
			<footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
				<Footer />
			</footer>
		</div>
	);
}
