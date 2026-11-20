import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ProvisionJobType, ProvisionJobStatus } from '@prisma/client';

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    @InjectQueue('provisioning') private provisioningQueue: Queue,
    @InjectQueue('provisioning-dlq') private dlqQueue: Queue,
    private prisma: PrismaService,
  ) {}

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

    // 2. Add to BullMQ with exponential backoff
    const bullJob = await this.provisioningQueue.add(
      type,
      {
        jobRecordId: jobRecord.id,
        ...payload,
      },
      {
        jobId: jobRecord.id, // idempotent job ID
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s, 4s, 8s, 16s, 32s
        },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );

    this.logger.log(`Enqueued provisioning job ${type} [DB ID: ${jobRecord.id}, BullMQ ID: ${bullJob.id}]`);
    return jobRecord;
  }

  async getJobStatus(jobId: string) {
    return this.prisma.provisionJob.findUnique({
      where: { id: jobId },
    });
  }

  async listJobs(page = 1, pageSize = 50, status?: ProvisionJobStatus) {
    const skip = (page - 1) * pageSize;
    const where = status ? { status } : {};

    const [data, total] = await Promise.all([
      this.prisma.provisionJob.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
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
