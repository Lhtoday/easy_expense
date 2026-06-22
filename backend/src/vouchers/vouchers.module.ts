import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VouchersController } from './vouchers.controller';
import { VouchersService } from './vouchers.service';

@Module({
  imports: [PrismaModule, IdentityModule, AuditModule],
  controllers: [VouchersController],
  providers: [VouchersService],
})
export class VouchersModule {}
