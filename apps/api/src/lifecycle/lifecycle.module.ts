import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ErpService } from './erp.service';
import { LifecycleService } from './lifecycle.service';
import { LifecycleController, NotificationsController } from './lifecycle.controller';

// EMAIL_PROVIDER, audit and logger are provided globally.
@Module({
  providers: [NotificationsService, ErpService, LifecycleService],
  controllers: [LifecycleController, NotificationsController],
  exports: [NotificationsService, ErpService],
})
export class LifecycleModule {}
