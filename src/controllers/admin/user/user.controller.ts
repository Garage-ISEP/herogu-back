import { MysqlService } from './../../../services/mysql.service';
import { DockerService } from 'src/services/docker.service';
import { ProjectRepository } from './../../../database/project/project.repository';
import { UserRepository } from './../../../database/user/user.repository';
import { Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { User } from 'src/database/user/user.entity';
import { AdminGuard } from 'src/guards/admin.guard';
import { AuthGuard } from 'src/guards/auth.guard';
import { InjectRepository } from '@nestjs/typeorm';

@Controller('admin/user')
@UseGuards(AuthGuard, AdminGuard)
export class AdminUserController {

  constructor(
    private readonly _docker: DockerService,
    private readonly _mysql: MysqlService,
    private readonly _userRepo: UserRepository,
    private readonly _projectRepo: ProjectRepository,
  ) { }

  @Get()
  public async getAll(@Query("from") skip?: number, @Query("size") take?: number, @Query("q") query?: string) {
    return await this._userRepo.getAll(take, skip, query);
  }

  @Patch(':id/admin')
  public async toggleAdmin(@Param("id") id: string) {
    await this._userRepo.toggleAdmin(id);
  }

  @Delete(":id")
  public async deleteUser(@Param("id") id: string) {
    const projects = await this._projectRepo.getProjectOwnedBy(id);
    for (const project of projects || []) {
      await this._docker.removeContainerFromName(project.name, true);
      await this._docker.removeImageFromName(project.name);
      if (project.mysqlInfo)
        await this._mysql.deleteMysqlDB(project.mysqlInfo);
      await project.remove();
    }
    return await this._userRepo.removeOne(id);
  }
}
