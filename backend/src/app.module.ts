import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApprovalsModule } from './approvals/approvals.module';
import { BudgetsModule } from './budgets/budgets.module';
import { ExpenseReportsModule } from './expense-reports/expense-reports.module';
import { ExpensePoliciesModule } from './expense-policies/expense-policies.module';
import { IdentityModule } from './identity/identity.module';
import { MasterDataModule } from './master-data/master-data.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env.local', '../.env', '.env'],
    }),
    PrismaModule,
    IdentityModule,
    MasterDataModule,
    BudgetsModule,
    ExpensePoliciesModule,
    ExpenseReportsModule,
    ApprovalsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
