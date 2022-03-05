import { ProjectRepository } from 'src/database/project/project.repository';
import { UserRepository } from './../../database/user/user.repository';
import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Collaborator, Role } from 'src/database/collaborator/collaborator.entity';
import { Project, ProjectType } from 'src/database/project/project.entity';
import { User } from 'src/database/user/user.entity';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { AuthGuard } from 'src/guards/auth.guard';
import { GithubService } from 'src/services/github.service';
import { AppLogger } from 'src/utils/app-logger.util';
import { CreateProjectDto } from './project.dto';
import { PhpInfo } from 'src/database/project/php-info.entity';
import { MysqlInfo } from 'src/database/project/mysql-info.entity';
import { NginxInfo } from 'src/database/project/nginx-info.entity';
import { createQueryBuilder } from 'typeorm';
import { CollaboratorRepository } from 'src/database/collaborator/collaborator.repository';
import { InjectRepository } from '@nestjs/typeorm';

@Controller('project')
@UseGuards(AuthGuard)
export class ProjectController {

  constructor(
    private readonly _logger: AppLogger,
    private readonly _github: GithubService,
    private readonly _projectRepo: ProjectRepository,
    private readonly _collabRepo: CollaboratorRepository,
    private readonly _userRepo: UserRepository
  ) { }

  @Get("/exists/:name")
  public async projectExists(@Param("name") name: string) {
    if (await this._projectRepo.entityExists({ name })) {
      throw new BadRequestException("This project name already exists");
    }
  }

  @Get("/check-bot-github")
  public async checkProjectGithubLink(@Query("link") link: string) {
    const status = await this._github.verifyInstallation(link);
    return status ? { status, tree: await this.getRepoTree(link) } : { status };
  }

  @Get("/repo-tree")
  public async getRepoTree(@Query("link") link: string, @Query("sha") sha?: string) {
    try {
      const res = await this._github.getRepositoryTree(link, sha);
      res.data.tree = res.data.tree.filter(el => el.type == "tree");
      return res.data;
    } catch (e) {
      return { tree: [] };
    }
  }

  @Post('/')
  public async createProject(@Body() req: CreateProjectDto, @CurrentUser() user: User) {
    if (user.collaborators.filter(c => c.project.creatorId == user.id).length > 0 && !user.admin)
      throw new BadRequestException("You already have created a project");
    if (await this._projectRepo.checkIfProjectExists(req.name, req.githubLink.toLowerCase()))
      throw new BadRequestException("This repository has already been registered");
    const installId = await this._github.getInstallationId(req.githubLink)
    const project = await this._projectRepo.createProject(req, installId, user);
    req.addedUsers = await this._userRepo.filterUserList(req.addedUsers);
    project.collaborators = await this._collabRepo.updateProjectCollaborators(project, req.addedUsers);
    return project;
  }

}
