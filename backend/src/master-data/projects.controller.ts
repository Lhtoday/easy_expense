import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUserGuard } from '../identity/current-user.guard';
import { CreateProjectDto, UpdateProjectDto } from './master-data.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(CurrentUserGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string) {
    return this.service.list(Number(page ?? 1), Number(pageSize ?? 20), keyword);
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
