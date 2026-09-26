import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module.js';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const started = performance.now();
    res.setHeader('X-Request-Id', requestId);
    res.on('finish', () => console.log(JSON.stringify({
      event: 'http_request', requestId, method: req.method,
      // Never log request bodies, headers, query strings, or employee details.
      route: req.route?.path ?? (req.path.startsWith('/app') ? '/app/*' : 'unmatched'),
      status: res.statusCode, durationMs: Math.round(performance.now() - started),
    })));
    next();
  });

  app.useStaticAssets(join(process.cwd(), '..', 'frontend', 'dist'), {
    prefix: '/app/',
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, process.env.HOST ?? '127.0.0.1');
  console.log(`Service Hub is running on http://localhost:${port}/app/`);
}

bootstrap();
