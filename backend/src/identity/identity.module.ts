import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CurrentUserGuard } from './current-user.guard';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController, UsersController, RolesController],
  providers: [AuthService, UsersService, RolesService, CurrentUserGuard],
  exports: [AuthService, CurrentUserGuard],
})
export class IdentityModule {}
