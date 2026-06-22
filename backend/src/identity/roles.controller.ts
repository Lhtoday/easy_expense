import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUserGuard, RequestWithUser } from './current-user.guard';
import { CreateRoleDto, UpdateRoleDto } from './role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(CurrentUserGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  list(@Req() request: RequestWithUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string) {
    return this.rolesService.list(request.user, Number(page ?? 1), Number(pageSize ?? 20), keyword);
  }

  @Get('permissions')
  permissions(@Req() request: RequestWithUser) {
    return this.rolesService.permissions(request.user);
  }

  @Post()
  create(@Req() request: RequestWithUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(request.user, dto);
  }

  @Patch(':id')
  update(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(request.user, id, dto);
  }

  @Delete(':id')
  remove(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.rolesService.remove(request.user, id);
  }
}
