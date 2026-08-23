import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from './app.module';
import { config } from 'dotenv';

async function bootstrap() {

	config();
	const app = await NestFactory.create(AppModule);

	app.use(express.json({
		limit: '10mb',
		verify: (req, res, buf) => {
			(req as any).rawBody = buf.toString();
		}
	}));

	app.enableCors({
		origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
		credentials: true,
	});
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
	await app.listen(process.env.PORT || 4000);
}
bootstrap();
