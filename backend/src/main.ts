import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(process.cwd(), '..', 'frontend', 'dist'), {
    prefix: '/app/',
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '127.0.0.1');
  console.log(`Service Hub is running on http://localhost:${port}/app/`);
}

bootstrap();
