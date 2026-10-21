// The Content-Security-Policy is not here: it carries a fresh nonce on every
// request, so src/middleware.ts makes it.

const securityHeaders = [
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'X-Frame-Options', value: 'DENY' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	// No includeSubDomains: this repo doesn't control natscho.my's own nginx
	// config, and an earlier incident (see progress_log.md) was specifically
	// caused by HSTS/subdomain interactions there — scoping this to just
	// ft.natscho.my itself avoids repeating that class of problem.
	// Production only (`next start`): on localhost, a browser that once trusted
	// a cert (mkcert) remembers HSTS for every localhost port for a year, and
	// then refuses the self-signed cert outright, with no "Proceed" button.
	...(process.env.NODE_ENV === 'development'
		? []
		: [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]),
	{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	poweredByHeader: false,
	env: {
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
	},
	async headers() {
		return [
			// No public Cache-Control on /login and /signup any more: every page
			// now carries its own CSP nonce (src/middleware.ts), and a cached copy
			// would hand the same nonce to everyone.
			// Security headers apply to every route.
			{
				source: '/(.*)',
				headers: securityHeaders,
			},
		];
	},
	// The settings page used to live at /settings/2fa; keep old links working.
	async redirects() {
		return [
			{ source: '/settings/2fa', destination: '/settings', permanent: true },
		];
	},
};
module.exports = nextConfig;
