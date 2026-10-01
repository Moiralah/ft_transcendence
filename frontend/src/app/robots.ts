import type { MetadataRoute } from 'next';

// Blocks known AI-training crawlers specifically, leaves regular search
// indexing (Googlebot, Bingbot, Applebot, etc.) untouched — this app stores
// real data about family members, including people who never signed up
// themselves and never consented to anything (see privacy policy section 2),
// so opting out of AI training scraping is a deliberate privacy stance, not
// a "hide from the internet" one.
//
// Where a provider has a distinct AI-training-only user-agent separate from
// their search crawler (Google-Extended vs Googlebot, Applebot-Extended vs
// Applebot), only the training-specific one is blocked — search presence is
// unaffected. Microsoft has no such split for Bing/Copilot, so there's no
// way to opt out of Bing's AI training without also losing Bing search
// indexing; left unblocked here since search presence was the priority.
//
// Honor-system only, not enforced: robots.txt is voluntary, and at least two
// of these (Bytespider, DeepSeekBot) have no public policy confirming they
// even respect it. Actual enforcement would need server-side User-Agent
// blocking at the WAF, a separate, stronger step not done here.
export default function robots(): MetadataRoute.Robots {
	const aiTrainingBots = [
		'GPTBot',
		'Google-Extended',
		'ClaudeBot',
		'Claude-User',
		'Claude-SearchBot',
		'PerplexityBot',
		'Perplexity-User',
		'Bytespider',
		'Meta-ExternalAgent',
		'Applebot-Extended',
		'Amazonbot',
	];

	return {
		rules: [
			{ userAgent: '*', allow: '/' },
			...aiTrainingBots.map((userAgent) => ({ userAgent, disallow: '/' })),
		],
	};
}
