import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Project } from 'src/database/project/project.entity';
import { ProjectRepository } from 'src/database/project/project.repository';
import { AdminGuard } from 'src/guards/admin.guard';
import { AuthGuard } from 'src/guards/auth.guard';
import { Like } from 'typeorm';

@Controller('admin/project')
@UseGuards(AuthGuard, AdminGuard)
export class AdminProjectController {

  constructor(
    private readonly _projectRepo: ProjectRepository
  ) { }
  @Get()
  public async getAll(@Query("skip") skip?: number, @Query("take") take?: number, @Query("q") query?: string) {
    return await this._projectRepo.getAll(take, skip, query);
  }

  @Delete(":id")
  public async deleteProject(@Param("id") id: number) {
    await this._projectRepo.removeOne(id);
  }
}
