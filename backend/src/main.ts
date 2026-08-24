import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from './app.module';
import { config } from 'dotenv';
import * as fs from 'fs';

async function bootstrap() {

	const httpsOptions = {
		key: fs.readFileSync('/app/certs/localhost-key.pem'),
		cert: fs.readFileSync('/app/certs/localhost.pem'),
	};

	config();
	const app = await NestFactory.create(AppModule, {httpsOptions});

	app.use(express.json({
		limit: '10mb',
		verify: (req, res, buf) => {
			(req as any).rawBody = buf.toString();
		}
	}));

	app.enableCors({
		origin: process.env.CORS_ORIGIN,
		credentials: true,
	});
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
	await app.listen(process.env.PORT);
}
bootstrap();
