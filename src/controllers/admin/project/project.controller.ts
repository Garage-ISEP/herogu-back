import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Project } from 'src/database/project.entity';
import { AdminGuard } from 'src/guards/admin.guard';
import { AuthGuard } from 'src/guards/auth.guard';
import { Like } from 'typeorm';

@Controller('project')
@UseGuards(AuthGuard, AdminGuard)
export class AdminProjectController {

  @Get()
  public async getAll(@Query("skip") skip?: number, @Query("take") take?: number, @Query("q") query?: string) {
    return await Project.find({ skip, take, where: query ? { name: Like(`%${query}%`) } : { }, relations: ["creator", "collaborators"] });
  }

  @Delete(":id")
  public async deleteProject(@Param("id") id: number) {
    return await (await Project.findOne(id)).remove();
  }
}
