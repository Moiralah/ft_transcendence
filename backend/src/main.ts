import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PublicModule } from './api/public/public.module';
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

	const sconfig = new DocumentBuilder()
		.setTitle('Family Tree API')
		.setDescription('Public API for the Family Tree application')
		.setVersion('1.0')
		.addApiKey(
			{
				type: 'apiKey',
				name: 'X-API-Key',
				in: 'header',
			},
			'X-API-Key',
		)
		.build();

	const apiPrefix = process.env.API_PREFIX || 'api';
	app.setGlobalPrefix(apiPrefix);

	const document = SwaggerModule.createDocument(app, sconfig, {include: [PublicModule]});

	SwaggerModule.setup('docs', app, document, {customCss: ".models {display: none !important;}"});

	app.use(express.json({
		limit: '10mb',
		verify: (req, res, buf) => {
			(req as any).rawBody = buf.toString();
		}
	}));

	app.enableCors({
		origin: process.env.CORS_ORIGIN,
		credentials: true,
		optionsSuccessStatus: 200,
	});
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
	await app.listen(process.env.PORT);
}
bootstrap();
