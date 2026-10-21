import { NextRequest, NextResponse } from 'next/server';

// The Content-Security-Policy, made per request with a fresh nonce.
// script-src has no 'unsafe-inline': only <script> tags carrying this
// request's nonce run (Next.js adds it to its own scripts, reading it from the
// request's CSP header below), plus what those scripts load ('strict-dynamic').
// A script injected into the page (XSS) has no nonce, so the browser refuses it.
// Pages must be rendered per request for this (root layout: dynamic).

function originOf(url: string | undefined): string {
	try { return url ? new URL(url).origin : ''; } catch { return ''; }
}

// Built in at build time (NEXT_PUBLIC_*), like the rest of the frontend.
const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL);
const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
// Supabase Realtime (presence, notifications) is a WebSocket on the same host.
// Firefox doesn't let an https:// source cover wss://.
const supabaseWs = supabaseOrigin.replace(/^http/, 'ws');
const connectSrc = ["'self'", apiOrigin, supabaseOrigin, supabaseWs].filter(Boolean).join(' ');

function contentSecurityPolicy(nonce: string): string {
	// 'unsafe-eval' is dev-only: `next dev`'s hot reload runs code through eval().
	const dev = process.env.NODE_ENV === 'development';
	return [
		"default-src 'self'",
		`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
		// Styles stay inline-friendly: style={{...}} and react-hot-toast inject
		// them, and a style can't read the session or send it anywhere.
		"style-src 'self' 'unsafe-inline'",
		`img-src 'self' data: blob: ${supabaseOrigin}`,
		"font-src 'self'",
		`connect-src ${connectSrc}`,
		"object-src 'none'",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'",
	].join('; ');
}

export function middleware(request: NextRequest) {
	const nonce = btoa(crypto.randomUUID());
	const csp = contentSecurityPolicy(nonce);

	// Next.js reads the nonce from the request's CSP header while rendering.
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set('Content-Security-Policy', csp);

	const response = NextResponse.next({ request: { headers: requestHeaders } });
	response.headers.set('Content-Security-Policy', csp);
	return response;
}

export const config = {
	matcher: [
		// Pages only: not the static files (no scripts run from their headers),
		// and not <Link> prefetches (rendered for a page that already has its nonce).
		{
			source: '/((?!_next/static|_next/image|favicon.ico).*)',
			missing: [
				{ type: 'header', key: 'next-router-prefetch' },
				{ type: 'header', key: 'purpose', value: 'prefetch' },
			],
		},
	],
};
