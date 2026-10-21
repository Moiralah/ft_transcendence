import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from './app.module';
import { config } from 'dotenv';
import * as fs from 'fs';
import { loadSecretsFromVault } from './vault/load-secrets';

async function bootstrap() {

	await loadSecretsFromVault();
	config(); // fills in anything Vault didn't provide (PORT, CORS_ORIGIN, etc.) — never overwrites what Vault already set

	const httpsOptions = {
		key: fs.readFileSync('/app/certs/localhost-key.pem'),
		cert: fs.readFileSync('/app/certs/localhost.pem'),
	};

	const app = await NestFactory.create(AppModule, httpsOptions ? { httpsOptions } : {});

	const apiPrefix = process.env.API_PREFIX || 'api';
	app.setGlobalPrefix(apiPrefix);

	app.use(express.json({
		limit: '10mb',
		verify: (req, res, buf) => {
			(req as any).rawBody = buf.toString();
		}
	}));

	// CSRF backstop on top of the SameSite=Strict session cookie: a request that
	// changes something and says it comes from another site is refused. No
	// Origin at all (curl, server-to-server) isn't a browser on another site.
	const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
	app.use((req, res, next) => {
		const origin = req.headers.origin;
		if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !allowedOrigins.includes(origin)) {
			res.status(403).json({ message: 'Request from another site refused.', error: 'Forbidden', statusCode: 403 });
			return;
		}
		next();
	});

	app.enableCors({
		origin: process.env.CORS_ORIGIN,
		credentials: true,
		optionsSuccessStatus: 200,
	});
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
	await app.listen(process.env.PORT);
}
bootstrap();
