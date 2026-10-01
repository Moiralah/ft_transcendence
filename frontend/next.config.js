const fs = require('fs');

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	env: {
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
	},
	// Next.js's App Router assumes a CDN (e.g. Vercel's) adds caching for the
	// RSC prefetch payload (`?_rsc=` requests a <Link> triggers in the
	// background). Self-hosting via `next start` behind our own WAF doesn't
	// get that for free, so a caching audit flags these as missing
	// Cache-Control. Only applied to genuinely static, non-personalized pages
	// (both confirmed `○ Static` in the build output) — do NOT copy this to
	// a per-user page like /dashboard without rethinking it.
	async headers() {
		return [
			{
				source: '/login',
				headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
			},
			{
				source: '/signup',
				headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
			},
		];
	},
};
module.exports = nextConfig;
