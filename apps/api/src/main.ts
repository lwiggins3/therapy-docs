import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // apps/web calls this API cross-origin from a different local port
  const port = process.env.API_PORT ?? 8080;
  await app.listen(port);
}

bootstrap();
