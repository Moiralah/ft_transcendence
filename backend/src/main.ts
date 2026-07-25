import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ----- raw body logger (temporary) -----
  // app.use((req, res, next) => {
  //   if (req.method === 'POST' && req.path === '/auth/login') {
  //     let data = '';
  //     req.on('data', chunk => { data += chunk; });
  //     req.on('end', () => {
  //       console.log('🔍 Raw login body:', data);
  //       next();
  //     });
  //   } else {
  //     next();
  //   }
  // });
  // ----------------------------------------

  //app.use(express.json({ limit: '10mb' }));

  app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      (req as any).rawBody = buf.toString();
    }
  }));

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '[localhost](http://localhost:3000)',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT || 4000);
}
bootstrap();
