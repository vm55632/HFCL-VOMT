import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { PanVerificationService } from './pan-verification.service';
import { VerificationCacheService } from './verification-cache.service';
import { VerificationController, ReviewQueueController } from './verification.controller';
import { PanVerificationController } from './pan-verification.controller';

// VerificationProvider, crypto and audit are provided globally.
@Module({
  providers: [VerificationService, PanVerificationService, VerificationCacheService],
  controllers: [VerificationController, ReviewQueueController, PanVerificationController],
  exports: [VerificationService, PanVerificationService, VerificationCacheService],
})
export class VerificationModule {}
