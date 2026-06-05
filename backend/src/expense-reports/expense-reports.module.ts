import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ExpenseReportsController } from './expense-reports.controller';
import { ExpenseReportsService } from './expense-reports.service';

@Module({
  imports: [PrismaModule, IdentityModule, StorageModule],
  controllers: [ExpenseReportsController],
  providers: [ExpenseReportsService],
})
export class ExpenseReportsModule {}
