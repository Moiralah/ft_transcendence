import React from 'react';

import { SkipLink } from '../../components/SkipLink';
import { Navbar } from '../../components/navbar';
import { Footer } from '../../components/footer';
import { Typography } from '../../components/typograph';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="mb-10">
			<Typography as="h2" variant="h3" className="mb-3">
				{title}
			</Typography>
			<div className="space-y-3 text-slate-600 text-base leading-relaxed">
				{children}
			</div>
		</section>
	);
}

export default function PrivacyPolicyPage() {
	return (
		<div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans">
			<SkipLink />
			<header id="navbar" tabIndex={-1} className="focus:outline-none">
				<Navbar btnText1="Get Started" btnHref1="/signup" btnText2="Login" btnHref2="/login" />
			</header>

			<main id="main-content" tabIndex={-1} className="focus:outline-none flex-1 max-w-3xl mx-auto px-6 pt-28 pb-16 w-full">
				<Typography as="h1" variant="h2" className="mb-2">
					Privacy Policy
				</Typography>
				<p className="text-sm text-slate-500 mb-10">Last updated: 2026-09-19</p>

				<p className="text-slate-600 text-base leading-relaxed mb-10 border-l-4 border-slate-200 pl-4">
					My Simple Family Tree is a student project built for the ft_transcendence
					curriculum. This policy describes, honestly and specifically, what data this
					application actually collects and how it&apos;s used — it is not reviewed by a
					lawyer and shouldn&apos;t be relied on as a legally binding document if this
					project is ever used for anything beyond course evaluation.
				</p>

				<Section title="1. Information We Collect">
					<p><strong>Account information.</strong> When you sign up, we collect your email
					address and, depending on how you sign in, either a password (handled entirely by
					Supabase Auth — we never see or store your raw password) or your name, email, and
					profile picture from Google/GitHub if you use OAuth sign-in.</p>
					<p><strong>Family tree data.</strong> Information you add to a tree — first and
					last name, gender, birth and death dates, a short bio, and a profile photo — for
					yourself and for anyone else you add as a family member.</p>
					<p><strong>Security information.</strong> If you enable two-factor authentication,
					we store a TOTP secret and a set of one-time recovery codes. Recovery codes are
					stored as bcrypt hashes, not in plain text — we cannot read them back.</p>
					<p><strong>Session data.</strong> A signed session token and your role are kept in
					your browser&apos;s local storage after you log in, so you stay signed in between
					page loads. This never leaves your device except when sent to our own backend.</p>
				</Section>

				<Section title="2. Data About People Who Aren't Registered Users">
					<p>This is a family tree app, so by nature you may add information about relatives
					— living or deceased — who have never created an account and never agreed to
					anything themselves. If you add someone to a tree, you&apos;re confirming you have
					the right to share that information, and you&apos;re responsible for keeping it
					accurate and for removing it if that person (or their guardian, if they&apos;re a
					minor) asks you to.</p>
				</Section>

				<Section title="3. How We Use Your Information">
					<p>To create and secure your account, let you build and collaborate on family
					trees with people you invite, enforce the roles and permissions you or a tree
					admin set, and — if you enable it — verify your identity via 2FA at login.</p>
					<p>We do not sell your data, and we do not use it for advertising. There is
					currently no analytics or tracking beyond what&apos;s needed to run the app.</p>
				</Section>

				<Section title="4. Third-Party Services">
					<p><strong>Supabase</strong> hosts our database and handles authentication
					(including Google/GitHub sign-in). Your account credentials and session are
					managed by Supabase&apos;s infrastructure, governed by
					{' '}<a href="https://supabase.com/privacy" className="underline" target="_blank" rel="noreferrer">Supabase&apos;s own privacy policy</a>.</p>
					<p><strong>Google / GitHub.</strong> If you choose to sign in with Google or
					GitHub, that provider shares your name, email, and profile picture with us —
					nothing else, and only after you approve it on their consent screen.</p>
				</Section>

				<Section title="5. Data Security">
					<p>Passwords are never handled or stored by our own code — that&apos;s entirely
					delegated to Supabase Auth. 2FA recovery codes are bcrypt-hashed. All traffic
					between your browser and our servers is encrypted (HTTPS). Access to
					administrative actions (viewing all users, changing roles, deleting accounts) is
					restricted to accounts with the <code>ADMIN</code> role, enforced on the server,
					not just hidden in the interface.</p>
				</Section>

				<Section title="6. Children's Information">
					<p>This service isn&apos;t intended for account creation by children under 13.
					However, because family trees legitimately include children — often added by a
					parent or guardian — a minor&apos;s name and birth date may appear as a family
					member record without that child holding an account themselves. If you&apos;re a
					parent or guardian and want a child&apos;s information removed, contact the tree
					owner or use the delete options available to you.</p>
				</Section>

				<Section title="7. Your Rights and Choices">
					<p>You can view and edit your own profile at any time. You can delete profiles or
					leave a tree you belong to. Site administrators can delete accounts (including
					yours) if needed — this is logged. If you want your account and associated data
					fully removed, contact a project admin.</p>
				</Section>

				<Section title="8. Changes to This Policy">
					<p>If this policy changes, we&apos;ll update the date at the top of this page.
					Since this is a small, actively-developed student project, expect this document to
					evolve alongside the app.</p>
				</Section>

				<Section title="9. Contact">
					<p>Questions about this policy or your data can be sent through the{' '}
					<a href="/feedback" className="underline">feedback form</a> linked in the footer.</p>
				</Section>
			</main>

			<footer id="footer" tabIndex={-1} className="focus:outline-none">
				<Footer />
			</footer>
		</div>
	);
}
