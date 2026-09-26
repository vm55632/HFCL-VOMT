import { Global, Module } from '@nestjs/common';
import { FieldEncryptionService } from './field-encryption.service';
import { BlindIndexService } from './blind-index.service';

/** Field encryption + blind index. KEY_PROVIDER and APP_CONFIG are provided globally. */
@Global()
@Module({
  providers: [FieldEncryptionService, BlindIndexService],
  exports: [FieldEncryptionService, BlindIndexService],
})
export class CryptoModule {}
