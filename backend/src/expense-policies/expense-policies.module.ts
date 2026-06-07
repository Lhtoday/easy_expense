import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpensePoliciesController } from './expense-policies.controller';
import { ExpensePoliciesService } from './expense-policies.service';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [ExpensePoliciesController],
  providers: [ExpensePoliciesService],
  exports: [ExpensePoliciesService],
})
export class ExpensePoliciesModule {}
