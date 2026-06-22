import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { IdentityModule } from '../identity/identity.module';
import { ExpensePoliciesModule } from '../expense-policies/expense-policies.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ExpenseReportsController } from './expense-reports.controller';
import { ExpenseReportsService } from './expense-reports.service';

@Module({
  imports: [PrismaModule, IdentityModule, StorageModule, ExpensePoliciesModule, BudgetsModule, AuditModule],
  controllers: [ExpenseReportsController],
  providers: [ExpenseReportsService],
})
export class ExpenseReportsModule {}
