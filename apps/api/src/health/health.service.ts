import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import * as net from "net";
import * as client from "prom-client";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly registry: client.Registry;

  // Custom Prometheus metrics
  public readonly httpRequestsTotal: client.Counter;
  public readonly mailboxesGauge: client.Gauge;
  public readonly domainsGauge: client.Gauge;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly config: ConfigService,
  ) {
    this.registry = new client.Registry();
    client.collectDefaultMetrics({
      register: this.registry,
      prefix: "freemailo_",
    });

    this.httpRequestsTotal = new client.Counter({
      name: "freemailo_http_requests_total",
      help: "Total HTTP requests handled by FreeMailo API",
      labelNames: ["method", "path", "status"],
      registers: [this.registry],
    });

    this.mailboxesGauge = new client.Gauge({
      name: "freemailo_mailboxes_total",
      help: "Total number of active mailboxes",
      registers: [this.registry],
    });

    this.domainsGauge = new client.Gauge({
      name: "freemailo_domains_total",
      help: "Total number of hosted domains",
      registers: [this.registry],
    });
  }

  private checkTcpService(
    host: string,
    port: number,
    timeoutMs = 2000,
  ): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();

      socket.setTimeout(timeoutMs);

      socket.on("connect", () => {
        const latencyMs = Date.now() - start;
        socket.destroy();
        resolve({ ok: true, latencyMs });
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({
          ok: false,
          latencyMs: Date.now() - start,
          error: "Connection timed out",
        });
      });

      socket.on("error", (err) => {
        socket.destroy();
        resolve({
          ok: false,
          latencyMs: Date.now() - start,
          error: err.message,
        });
      });

      socket.connect(port, host);
    });
  }

  async checkHealth() {
    const start = Date.now();
    const services: Record<string, any> = {};

    // 1. PostgreSQL
    const pgStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.postgres = { status: "up", latencyMs: Date.now() - pgStart };
    } catch (err: any) {
      services.postgres = {
        status: "down",
        error: "Database unavailable",
        latencyMs: Date.now() - pgStart,
      };
    }

    // 2. Redis
    const redisStart = Date.now();
    try {
      const pong = await this.redisService.getClient().ping();
      services.redis = {
        status: pong === "PONG" ? "up" : "down",
        latencyMs: Date.now() - redisStart,
      };
    } catch (err: any) {
      services.redis = {
        status: "down",
        error: "Cache unavailable",
        latencyMs: Date.now() - redisStart,
      };
    }

    // 3. Postfix SMTP
    const postfixHost = this.config.get<string>("POSTFIX_HOST", "postfix");
    const postfixResult = await this.checkTcpService(postfixHost, 587);
    services.postfix = {
      status: postfixResult.ok ? "up" : "down",
      latencyMs: postfixResult.latencyMs,
      ...(postfixResult.error && { error: postfixResult.error }),
    };

    // 4. Dovecot IMAP
    const dovecotHost = this.config.get<string>("DOVECOT_HOST", "dovecot");
    const dovecotResult = await this.checkTcpService(dovecotHost, 993);
    services.dovecot = {
      status: dovecotResult.ok ? "up" : "down",
      latencyMs: dovecotResult.latencyMs,
      ...(dovecotResult.error && { error: dovecotResult.error }),
    };

    const rspamdStart = Date.now();
    const rspamdUp = await fetch(
      `http://${process.env.RSPAMD_HOST || "rspamd"}:11334/ping`,
      {
        signal: AbortSignal.timeout(2000),
      },
    )
      .then((response) => response.ok)
      .catch(() => false);
    services.rspamd = {
      status: rspamdUp ? "up" : "down",
      latencyMs: Date.now() - rspamdStart,
    };

    const isHealthy = Object.values(services).every((s) => s.status === "up");

    return {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      totalLatencyMs: Date.now() - start,
      services,
    };
  }

  async getMetrics(): Promise<string> {
    try {
      const [mailboxCount, domainCount] = await Promise.all([
        this.prisma.mailbox.count({
          where: { isActive: true, deletedAt: null },
        }),
        this.prisma.domain.count({
          where: { isActive: true, deletedAt: null },
        }),
      ]);
      this.mailboxesGauge.set(mailboxCount);
      this.domainsGauge.set(domainCount);
    } catch (err) {
      this.logger.warn(`Failed to collect business metrics: ${err}`);
    }

    return this.registry.metrics();
  }
}
