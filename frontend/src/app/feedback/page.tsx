'use client';

import React, { useState } from 'react';

import { SkipLink } from '../../components/SkipLink';
import { Navbar } from '../../components/navbar';
import { Footer } from '../../components/footer';
import { Typography } from '../../components/typograph';

// Same look as the global `input` style (globals.css styles input, not these).
const fieldClass = 'block w-full my-2 p-2.5 border border-[#ddd] rounded-lg text-sm bg-white';

const CATEGORIES = [
	{ value: 'bug', label: 'Something is broken' },
	{ value: 'idea', label: 'Idea or suggestion' },
	{ value: 'question', label: 'Question' },
	{ value: 'other', label: 'Something else' },
];

export default function FeedbackPage() {
	const [category, setCategory] = useState('bug');
	const [message, setMessage] = useState('');
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [website, setWebsite] = useState(''); // honeypot, hidden from people
	const [error, setError] = useState<string | null>(null);
	const [sent, setSent] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (message.trim().length < 10) {
			setError('Please write at least 10 characters.');
			return;
		}
		setSubmitting(true);
		try {
			const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/feedback`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ category, message, name, email, website, page: document.referrer }),
			});
			if (res.ok) {
				setSent(true);
				return;
			}
			if (res.status === 403) {
				// The WAF blocks text that looks like an attack (e.g. code snippets).
				setError('Our security filter blocked this message. Please rephrase it (e.g. leave out code) and try again.');
				return;
			}
			const data = await res.json().catch(() => ({}));
			setError(data.message || 'Something went wrong. Please try again later.');
		} catch {
			setError('Could not reach the server. Please check your connection and try again.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans">
			<SkipLink />
			<header id="navbar" tabIndex={-1} className="focus:outline-none">
				<Navbar btnText1="Get Started" btnHref1="/signup" btnText2="Login" btnHref2="/login" />
			</header>

			<main id="main-content" tabIndex={-1} className="focus:outline-none flex-1 max-w-xl mx-auto px-6 pt-28 pb-16 w-full">
				<Typography as="h1" variant="h2" className="mb-2">
					Give feedback
				</Typography>
				<p className="text-slate-600 text-base leading-relaxed mb-8">
					Found a bug, have an idea, or a question about your data? Tell us here. It goes straight
					to the project team by email.
				</p>

				{sent ? (
					<div className="success text-base" role="status">
						Thanks! Your feedback was sent.{email ? ' We\'ll reply to the address you gave if needed.' : ''}
					</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-2" noValidate>
						<label htmlFor="feedback-category" className="block text-sm font-medium text-slate-800">
							What is it about?
						</label>
						<select
							id="feedback-category"
							value={category}
							onChange={(e) => setCategory(e.target.value)}
							className={fieldClass}
						>
							{CATEGORIES.map((c) => (
								<option key={c.value} value={c.value}>{c.label}</option>
							))}
						</select>

						<label htmlFor="feedback-message" className="block text-sm font-medium text-slate-800">
							Your message
						</label>
						<textarea
							id="feedback-message"
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							required
							minLength={10}
							maxLength={5000}
							rows={6}
							className={fieldClass}
						/>
						<p className="text-xs text-slate-500">{message.length}/5000</p>

						<label htmlFor="feedback-name" className="block text-sm font-medium text-slate-800">
							Name <span className="font-normal text-slate-500">(optional)</span>
						</label>
						<input
							id="feedback-name"
							type="text"
							autoComplete="name"
							maxLength={100}
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>

						<label htmlFor="feedback-email" className="block text-sm font-medium text-slate-800">
							Email <span className="font-normal text-slate-500">(optional, only if you want a reply)</span>
						</label>
						<input
							id="feedback-email"
							type="email"
							autoComplete="email"
							maxLength={200}
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>

						{/* Spam trap: hidden from people and screen readers; bots fill it in. */}
						<div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
							<label htmlFor="feedback-website">Website</label>
							<input
								id="feedback-website"
								type="text"
								tabIndex={-1}
								autoComplete="off"
								value={website}
								onChange={(e) => setWebsite(e.target.value)}
							/>
						</div>

						<button type="submit" disabled={submitting}>
							{submitting ? 'Sending...' : 'Send feedback'}
						</button>
						{error && <div className="error" role="alert">{error}</div>}
					</form>
				)}
			</main>

			<footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
				<Footer />
			</footer>
		</div>
	);
}
