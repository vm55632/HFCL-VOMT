import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController, ReviewQueueController } from './verification.controller';

// VerificationProvider, crypto and audit are provided globally.
@Module({
  providers: [VerificationService],
  controllers: [VerificationController, ReviewQueueController],
  exports: [VerificationService],
})
export class VerificationModule {}
