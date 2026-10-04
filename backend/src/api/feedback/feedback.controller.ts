import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { FeedbackInput, FeedbackService } from './feedback.service';

// Public on purpose: the footer, privacy and terms pages link here for
// visitors who may not have (or can't create) an account. Spam is handled
// in the service (honeypot, per-IP and daily limits).
@Controller('feedback')
export class FeedbackController {
	constructor(private readonly feedback: FeedbackService) { }

	@Post()
	@HttpCode(200)
	async submit(@Body() body: FeedbackInput, @Req() req) {
		return this.feedback.submit(body ?? {}, clientIp(req));
	}
}

// Production chain: browser -> GCP nginx -> WAF -> backend. GCP nginx appends
// the real client to X-Forwarded-For and the WAF appends what it saw (the
// proxy), so the real client is the second-to-last entry; anything earlier
// was sent by the client and can be faked. Locally there's one hop less, and
// worst case a wrong guess only affects whose rate limit a request counts
// against (the daily cap still holds).
function clientIp(req: any): string {
	const xff = String(req.headers['x-forwarded-for'] ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return xff.length >= 2 ? xff[xff.length - 2] : xff[0] ?? req.ip ?? 'unknown';
}
