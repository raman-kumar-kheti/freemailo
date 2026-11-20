import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProvisioningService } from './provisioning.service';
import { ProvisioningProcessor } from './processors/provisioning.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'provisioning' },
      { name: 'provisioning-dlq' },
    ),
  ],
  providers: [ProvisioningService, ProvisioningProcessor],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
