import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpensePoliciesController } from './expense-policies.controller';
import { ExpensePoliciesService } from './expense-policies.service';

@Module({
  imports: [PrismaModule, IdentityModule, AuditModule],
  controllers: [ExpensePoliciesController],
  providers: [ExpensePoliciesService],
  exports: [ExpensePoliciesService],
})
export class ExpensePoliciesModule {}
