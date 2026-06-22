import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CurrentUserGuard, RequestWithUser } from './current-user.guard';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(CurrentUserGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@Req() request: RequestWithUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string) {
    return this.usersService.list(request.user, Number(page ?? 1), Number(pageSize ?? 20), keyword);
  }

  @Post()
  create(@Req() request: RequestWithUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(request.user, dto);
  }

  @Patch(':id')
  update(@Req() request: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(request.user, id, dto);
  }

  @Delete(':id')
  remove(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.usersService.remove(request.user, id);
  }
}
