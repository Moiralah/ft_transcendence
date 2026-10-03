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

export default function TermsOfServicePage() {
	return (
		<div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans">
			<SkipLink />
			<header id="navbar" tabIndex={-1} className="focus:outline-none">
				<Navbar btnText1="Get Started" btnHref1="/signup" btnText2="Login" btnHref2="/login" />
			</header>

			<main id="main-content" tabIndex={-1} className="focus:outline-none flex-1 max-w-3xl mx-auto px-6 pt-28 pb-16 w-full">
				<Typography as="h1" variant="h2" className="mb-2">
					Terms of Service
				</Typography>
				<p className="text-sm text-slate-500 mb-10">Last updated: 2026-09-19</p>

				<p className="text-slate-600 text-base leading-relaxed mb-10 border-l-4 border-slate-200 pl-4">
					My Simple Family Tree is a student project built for the ft_transcendence
					curriculum. These terms describe how the service is actually meant to be used —
					they are not reviewed by a lawyer and shouldn&apos;t be treated as a legally
					binding contract if this project is ever used beyond course evaluation.
				</p>

				<Section title="1. Acceptance of Terms">
					<p>By creating an account, you agree to use this service as described here. If you
					don&apos;t agree, please don&apos;t create an account.</p>
				</Section>

				<Section title="2. What This Service Does">
					<p>My Simple Family Tree lets you create family trees, add profiles for yourself
					and relatives, invite others to collaborate, and manage who can view or edit what
					through per-tree and site-wide roles. It's a work in progress — see the project
					README for what's built and what isn't yet.</p>
				</Section>

				<Section title="3. Your Account">
					<p>You're responsible for keeping your login credentials confidential and for
					anything that happens under your account. We strongly recommend enabling
					two-factor authentication under Security settings — if you do, keep your saved
					recovery codes somewhere safe, since we cannot recover them for you if you lose
					both your authenticator app and your codes.</p>
					<p>You must provide an email you actually control, since it's how your account is
					identified and (where applicable) how you'd be contacted about it.</p>
				</Section>

				<Section title="4. Acceptable Use">
					<p>Don't use this service to store or share information about a real person
					without a reasonable basis for doing so (for family members, being related to them
					is enough — this isn't a tool for building profiles of strangers). Don't attempt to
					access accounts, trees, or admin functionality you haven't been granted access to.
					Don't use the service to harass, impersonate, or misrepresent anyone.</p>
				</Section>

				<Section title="5. Content You Add">
					<p>You keep ownership of the family tree information you add. By adding it, you're
					giving this service permission to store and display it to the people you've given
					access to (via tree membership and roles) so the app can actually function. You're
					responsible for the accuracy of what you add and for having a reasonable basis to
					share information about other people, including relatives who aren't account
					holders themselves.</p>
				</Section>

				<Section title="6. Roles and Permissions">
					<p>Trees have their own roles (admin, moderator, member, and so on) that control
					who can edit that specific tree. Separately, the platform has site-wide roles
					(admin, moderator, user) — site admins can view all accounts, change a user's
					site-wide role, and delete accounts, primarily for moderation and support
					purposes. A user cannot grant themselves admin access; it's assigned directly by an
					existing admin.</p>
				</Section>

				<Section title="7. Termination">
					<p>You can stop using the service and ask for your account to be removed at any
					time. We may suspend or remove an account that violates section 4, or as needed to
					keep the service and other users' data safe.</p>
				</Section>

				<Section title="8. No Warranty">
					<p>This is a student project, actively under development, provided "as is." Features
					may be incomplete, change, or break — see the README's module status table for
					what's actually finished versus in progress. We make no guarantee the service will
					be available, error-free, or fit for any particular purpose.</p>
				</Section>

				<Section title="9. Limitation of Liability">
					<p>To the extent permitted by law, this project and its contributors aren't liable
					for any loss or damage arising from your use of the service — including loss of
					data you've added. Given this is a course project rather than a commercial product,
					please don't store information here you can't afford to lose.</p>
				</Section>

				<Section title="10. Changes to These Terms">
					<p>If these terms change, we'll update the date at the top of this page. Continued
					use of the service after a change means you accept the updated terms.</p>
				</Section>

				<Section title="11. Contact">
					<p>Questions about these terms can be sent through the{' '}
					<a href="/feedback" className="underline">feedback form</a> linked in the footer.</p>
				</Section>
			</main>

			<footer id="footer" tabIndex={-1} className="focus:outline-none">
				<Footer />
			</footer>
		</div>
	);
}
