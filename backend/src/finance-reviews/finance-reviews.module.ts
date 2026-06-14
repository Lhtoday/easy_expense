import { Module } from '@nestjs/common';
import { BudgetsModule } from '../budgets/budgets.module';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FinanceReviewsController } from './finance-reviews.controller';
import { FinanceReviewsService } from './finance-reviews.service';

@Module({
  imports: [PrismaModule, IdentityModule, BudgetsModule],
  controllers: [FinanceReviewsController],
  providers: [FinanceReviewsService],
})
export class FinanceReviewsModule {}
