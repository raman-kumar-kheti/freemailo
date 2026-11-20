import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { ProvisionJobType, ProvisionJobStatus } from "@prisma/client";

@Injectable()
export class ProvisioningService implements OnModuleInit, OnModuleDestroy {
  private recoveryTimer?: ReturnType<typeof setInterval>;
  private recovering = false;
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    @InjectQueue("provisioning") private provisioningQueue: Queue,
    @InjectQueue("provisioning-dlq") private dlqQueue: Queue,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.reconcile().catch(() =>
      this.logger.warn("Provisioning recovery will retry"),
    );
    this.recoveryTimer = setInterval(
      () =>
        void this.reconcile().catch(() =>
          this.logger.warn("Provisioning recovery will retry"),
        ),
      30000,
    );
    this.recoveryTimer.unref();
  }

  onModuleDestroy() {
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
  }

  async reconcile() {
    if (this.recovering) return;
    this.recovering = true;
    try {
      const records = await this.prisma.provisionJob.findMany({
        where: { status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
        take: 100,
        orderBy: { createdAt: "asc" },
      });
      for (const record of records) {
        if (!(await this.provisioningQueue.getJob(record.id))) {
          await this.provisioningQueue.add(
            record.type,
            { ...(record.payload as object), jobRecordId: record.id },
            {
              jobId: record.id,
              attempts: record.maxAttempts,
              backoff: { type: "exponential", delay: 2000 },
              removeOnComplete: 100,
              removeOnFail: false,
            },
          );
        }
      }
    } finally {
      this.recovering = false;
    }
  }

  /**
   * Enqueue a provisioning job with exponential backoff and database tracking.
   */
  async enqueueJob(type: ProvisionJobType, payload: Record<string, any>) {
    // 1. Create DB record for tracking
    const jobRecord = await this.prisma.provisionJob.create({
      data: {
        type,
        status: ProvisionJobStatus.PENDING,
        payload,
        attempts: 0,
        maxAttempts: 5,
      },
    });

    // The durable SQL record remains pending if Redis is unavailable; the
    // reconciler delivers it after recovery instead of losing the operation.
    await this.reconcile().catch(() =>
      this.logger.warn(
        `Provisioning job ${jobRecord.id} awaits queue recovery`,
      ),
    );
    return jobRecord;
  }

  async retryJob(id: string) {
    const record = await this.prisma.provisionJob.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Job not found");
    if (!["FAILED", "DEAD_LETTER"].includes(record.status))
      throw new BadRequestException("Only failed jobs can be retried");
    const queued = await this.provisioningQueue.getJob(id);
    if (queued) {
      if ((await queued.getState()) !== "failed")
        throw new BadRequestException("Job is still being retried");
      await queued.remove();
    }
    await this.prisma.provisionJob.update({
      where: { id },
      data: {
        status: "PENDING",
        attempts: 0,
        lastError: null,
        completedAt: null,
      },
    });
    await this.reconcile();
    return this.getJobStatus(id);
  }

  async getJobStatus(jobId: string) {
    return this.prisma.provisionJob.findUnique({
      where: { id: jobId },
    });
  }

  async listJobs(page = 1, pageSize = 50, status?: ProvisionJobStatus) {
    const skip = (page - 1) * pageSize;
    if (status && !Object.values(ProvisionJobStatus).includes(status))
      throw new BadRequestException("Invalid job status");
    const where = status ? { status } : {};

    const [data, total] = await Promise.all([
      this.prisma.provisionJob.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.provisionJob.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
