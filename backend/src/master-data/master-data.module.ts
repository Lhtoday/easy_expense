import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { CostCentersController } from './cost-centers.controller';
import { CostCentersService } from './cost-centers.service';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [DepartmentsController, CostCentersController, ProjectsController],
  providers: [DepartmentsService, CostCentersService, ProjectsService],
})
export class MasterDataModule {}
