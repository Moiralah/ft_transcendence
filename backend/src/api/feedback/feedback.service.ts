import {
	BadRequestException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService, malaysiaTime, oneLine } from '../../mail/mail.service';

export interface FeedbackInput {
	category?: string;
	message?: string;
	name?: string;
	email?: string;
	page?: string;
	website?: string; // honeypot: hidden from people, bots fill it in
}

const CATEGORIES = ['bug', 'idea', 'question', 'other'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public, unauthenticated form, so it has to be cheap to abuse-proof.
// In memory is fine for one backend instance; resets on restart.
const PER_IP_LIMIT = 3;
const PER_IP_WINDOW_MS = 10 * 60 * 1000;
const DAILY_LIMIT = 50; // all senders together, so spoofed IPs can't flood the inbox

@Injectable()
export class FeedbackService {
	private readonly logger = new Logger(FeedbackService.name);
	private readonly recentByIp = new Map<string, number[]>();
	private dailyCount = 0;
	private dailyResetAt = Date.now() + 24 * 60 * 60 * 1000;

	constructor(
		private readonly config: ConfigService,
		private readonly mail: MailService,
	) { }

	async submit(input: FeedbackInput, ip: string) {
		// Bots that fill the hidden field get a normal-looking success, nothing sent.
		if (input.website) {
			return { ok: true };
		}

		const message = (input.message ?? '').trim();
		if (message.length < 10) throw new BadRequestException('Please write at least 10 characters.');
		if (message.length > 5000) throw new BadRequestException('Please keep it under 5000 characters.');

		const category = CATEGORIES.includes(input.category as any) ? input.category! : 'other';
		// Single-line fields end up in mail headers (subject, reply-to): strip
		// line breaks so they can't inject extra headers.
		const name = oneLine(input.name).slice(0, 100);
		const email = oneLine(input.email).slice(0, 200);
		if (email && !EMAIL_RE.test(email)) throw new BadRequestException('That email address doesn\'t look right.');
		const page = oneLine(input.page).slice(0, 300);

		this.checkRateLimit(ip);

		const to = this.config.get<string>('FEEDBACK_TO');
		if (!this.mail.isConfigured() || !to) {
			this.logger.warn('Feedback not sent: SMTP or FEEDBACK_TO not configured');
			throw new ServiceUnavailableException('Feedback is temporarily unavailable. Please try again later.');
		}

		const from = name || email || 'anonymous visitor';
		try {
			await this.mail.send({
				fromName: 'My Simple Family Tree feedback',
				to,
				replyTo: email || undefined,
				subject: `[Feedback · ${category}] from ${from}`,
				text: [
					`Category: ${category}`,
					`Name: ${name || '(not given)'}`,
					`Email: ${email || '(not given)'}`,
					`Page: ${page || '(unknown)'}`,
					`Sent: ${malaysiaTime()}`,
					'',
					message,
				].join('\n'),
			});
		} catch (err) {
			this.logger.error(`Feedback email failed: ${(err as Error).message}`);
			throw new ServiceUnavailableException('Couldn\'t send your feedback right now. Please try again later.');
		}
		return { ok: true };
	}

	private checkRateLimit(ip: string) {
		const now = Date.now();
		if (now > this.dailyResetAt) {
			this.dailyCount = 0;
			this.dailyResetAt = now + 24 * 60 * 60 * 1000;
		}
		const recent = (this.recentByIp.get(ip) ?? []).filter((t) => now - t < PER_IP_WINDOW_MS);
		if (recent.length >= PER_IP_LIMIT || this.dailyCount >= DAILY_LIMIT) {
			throw new HttpException('Too much feedback at once. Please wait a few minutes and try again.', HttpStatus.TOO_MANY_REQUESTS);
		}
		recent.push(now);
		this.recentByIp.set(ip, recent);
		this.dailyCount++;
		if (this.recentByIp.size > 10000) this.recentByIp.clear(); // keep memory bounded
	}
}
