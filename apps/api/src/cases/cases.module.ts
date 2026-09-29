import { Module } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { WorkflowModule } from '../workflow/workflow.module';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [WorkflowModule, MasterDataModule], // crypto + audit are global
  providers: [CasesService],
  controllers: [CasesController],
  exports: [CasesService],
})
export class CasesModule {}
