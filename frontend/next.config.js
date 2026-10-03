const fs = require('fs');

// Derived from the same env vars already passed as Docker build args
// (docker-compose.prod.yml), so this adapts correctly to local/security-stack/
// production without hardcoding a domain — connect-src needs the API and
// Supabase origins explicitly since both are cross-origin from the frontend
// itself (different port counts as a different origin for CSP purposes).
function originOf(url) {
	try { return new URL(url).origin; } catch { return ''; }
}
const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL);
const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
const connectSrc = ["'self'", apiOrigin, supabaseOrigin].filter(Boolean).join(' ');

// 'unsafe-inline' on both script-src and style-src is a deliberate, known
// loosening, not an oversight: self-hosted Next.js App Router (via `next
// start`, no Vercel-style CDN/edge in front of it) injects its own inline
// bootstrap/hydration <script> tags, and this app's design system uses
// inline style={{...}} extensively (9 files) plus react-hot-toast's
// dynamically-injected styles. Next.js's own docs cover the fully-strict
// alternative (a per-request nonce via middleware.ts) — not done here since
// it's a bigger change this hasn't been tested against. CSP is enforced
// client-side only, so this can't be verified by curl/build — check the
// browser console for CSP violation errors after deploying, particularly on
// /settings/2fa (renders a data: URI QR code image) and any page making API
// calls, and loosen/tighten specific directives based on what's actually
// reported, not assumed.
// 'unsafe-eval' is dev-only: `next dev`'s webpack Fast Refresh/HMR runtime
// evaluates hot-reloaded code via eval(), and this CSP without it makes the
// entire client bundle throw on load (EvalError) — not a minor glitch, the
// whole app goes dead since no JS executes at all. `next start` (prod, local
// prod-mode testing) doesn't use eval and never needs this loosened.
const scriptSrc = process.env.NODE_ENV === 'development'
	? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
	: "script-src 'self' 'unsafe-inline'";

const csp = [
	"default-src 'self'",
	scriptSrc,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data:",
	"font-src 'self'",
	`connect-src ${connectSrc}`,
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
].join('; ');

const securityHeaders = [
	{ key: 'Content-Security-Policy', value: csp },
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'X-Frame-Options', value: 'DENY' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	// No includeSubDomains: this repo doesn't control natscho.my's own nginx
	// config, and an earlier incident (see progress_log.md) was specifically
	// caused by HSTS/subdomain interactions there — scoping this to just
	// ft.natscho.my itself avoids repeating that class of problem.
	{ key: 'Strict-Transport-Security', value: 'max-age=31536000' },
	{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	env: {
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
	},
	async headers() {
		return [
			// Next.js's App Router assumes a CDN (e.g. Vercel's) adds caching for
			// the RSC prefetch payload (`?_rsc=` requests a <Link> triggers in the
			// background). Self-hosting via `next start` behind our own WAF doesn't
			// get that for free, so a caching audit flags these as missing
			// Cache-Control. Only applied to genuinely static, non-personalized
			// pages (both confirmed `○ Static` in the build output) — do NOT copy
			// this to a per-user page like /dashboard without rethinking it.
			{
				source: '/login',
				headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
			},
			{
				source: '/signup',
				headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
			},
			// Security headers apply to every route.
			{
				source: '/(.*)',
				headers: securityHeaders,
			},
		];
	},
};
module.exports = nextConfig;
