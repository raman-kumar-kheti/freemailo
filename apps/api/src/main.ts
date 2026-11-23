import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger, ConsoleLogger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import * as cookieParser from "cookie-parser";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { ResponseInterceptor } from "./common/response.interceptor";
import { csrfProtection } from "./common/security";
import { AppModule } from "./app.module";
import { HealthService } from "./health/health.service";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true }),
  });

  // Security Headers
  // Trust only an operator-specified proxy/CIDR. Never trust client-provided
  // forwarding headers by default when deciding authentication rate limits.
  if (process.env.TRUST_PROXY) {
    app
      .getHttpAdapter()
      .getInstance()
      .set(
        "trust proxy",
        process.env.TRUST_PROXY.split(",").map((value) => value.trim()),
      );
  }
  app.use(helmet());

  // Cookie Parser for JWT Refresh Token cookies
  app.use(cookieParser());
  app.use(csrfProtection);
  const metrics = app.get(HealthService);
  app.use((req, res, next) => {
    res.once("finish", () =>
      metrics.httpRequestsTotal.inc({
        method: req.method,
        path: req.route?.path || "unmatched",
        status: String(res.statusCode),
      }),
    );
    next();
  });
  app.enableShutdownHooks();
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // CORS
  app.enableCors({
    origin: (process.env.APP_URL || "http://localhost:3000").split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  });

  // OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle("FreeMailo API")
    .setDescription(
      "Self-hosted mail and administration API. Browser sessions use HttpOnly cookies; cookie-authenticated mutations require X-Requested-With: FreeMailo.",
    )
    .setVersion("1.0.0")
    .addBearerAuth()
    .addCookieAuth("access_token")
    .addTag("Auth")
    .addTag("Admin")
    .addTag("Mail")
    .addTag("Settings")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 FreeMailo API listening on port ${port}`);
  logger.log(
    `📖 Swagger API docs available at http://localhost:${port}/api/docs`,
  );
}

bootstrap();
