import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditController } from './audit/audit.controller';
import { AuditModule } from './audit/audit.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { BudgetsModule } from './budgets/budgets.module';
import { ExpenseReportsModule } from './expense-reports/expense-reports.module';
import { FinanceReviewsModule } from './finance-reviews/finance-reviews.module';
import { ExpensePoliciesModule } from './expense-policies/expense-policies.module';
import { IdentityModule } from './identity/identity.module';
import { MasterDataModule } from './master-data/master-data.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { VouchersModule } from './vouchers/vouchers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env.local', '../.env', '.env'],
    }),
    PrismaModule,
    AuditModule,
    IdentityModule,
    MasterDataModule,
    BudgetsModule,
    ExpensePoliciesModule,
    ExpenseReportsModule,
    ApprovalsModule,
    FinanceReviewsModule,
    PaymentsModule,
    VouchersModule,
  ],
  controllers: [AppController, AuditController],
  providers: [AppService],
})
export class AppModule {}
