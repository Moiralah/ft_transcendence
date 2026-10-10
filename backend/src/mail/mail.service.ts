import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailMessage {
	to: string;
	subject: string;
	text: string;
	replyTo?: string;
	fromName?: string; // display name; the address is always SMTP_USER
}

// One place that sends email for the whole backend (feedback form, role and
// suspension notices, friend requests next). Two set-ups:
// - production: Gmail on :587 with STARTTLS, SMTP_USER + SMTP_PASS (from Vault);
// - local: a mail catcher without login (Supabase's Mailpit: SMTP_HOST =
//   host.docker.internal, SMTP_PORT = 54325), nothing really leaves the machine.
@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);
	private transport: nodemailer.Transporter | null = null;

	constructor(private readonly config: ConfigService) { }

	private get host() { return this.config.get<string>('SMTP_HOST') || 'smtp.gmail.com'; }
	private get user() { return this.config.get<string>('SMTP_USER') || ''; }
	private get pass() { return this.config.get<string>('SMTP_PASS') || ''; }
	private get usesLogin() { return Boolean(this.user && this.pass); }

	// Gmail needs a login; a local catcher (any other host) doesn't.
	isConfigured(): boolean {
		return this.usesLogin || this.host !== 'smtp.gmail.com';
	}

	private getTransport(): nodemailer.Transporter {
		if (!this.transport) {
			const port = Number(this.config.get<string>('SMTP_PORT') || 587);
			this.transport = this.usesLogin
				? nodemailer.createTransport({
					host: this.host, port, secure: false, requireTLS: true, // STARTTLS on 587
					auth: { user: this.user, pass: this.pass },
				})
				: nodemailer.createTransport({ host: this.host, port, secure: false, ignoreTLS: true });
		}
		return this.transport;
	}

	// Throws on failure: the caller decides whether that's an error for the user.
	async send(message: MailMessage): Promise<void> {
		if (!this.isConfigured()) {
			throw new Error('SMTP is not configured (SMTP_USER / SMTP_PASS)');
		}
		const address = this.user || 'no-reply@localhost'; // Gmail only sends as the logged-in account
		await this.getTransport().sendMail({
			from: `"${message.fromName ?? 'My Simple Family Tree'}" <${address}>`,
			to: message.to,
			replyTo: message.replyTo,
			subject: oneLine(message.subject),
			text: message.text,
		});
	}

	// For notices that must never block the action they describe (a role
	// change is saved even if Gmail is down): logs instead of throwing.
	async sendQuietly(message: MailMessage, what: string): Promise<boolean> {
		try {
			await this.send(message);
			return true;
		} catch (err) {
			this.logger.warn(`${what} email to ${message.to} not sent: ${(err as Error).message}`);
			return false;
		}
	}
}

// Header values (subject, names) must stay on one line, or they could inject headers.
export function oneLine(value?: string): string {
	return (value ?? '').replace(/[\r\n]+/g, ' ').trim();
}
