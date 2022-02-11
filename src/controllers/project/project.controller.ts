import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Collaborator, Role } from 'src/database/collaborator.entity';
import { Project, ProjectType } from 'src/database/project.entity';
import { User } from 'src/database/user.entity';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { AuthGuard } from 'src/guards/auth.guard';
import { GithubService } from 'src/services/github.service';
import { AppLogger } from 'src/utils/app-logger.util';
import { CreateProjectDto } from './project.dto';
import { PhpInfo } from 'src/database/php-info.entity';
import { MysqlInfo } from 'src/database/mysql-info.entity';
import { NginxInfo } from 'src/database/nginx-info.entity';

@Controller('project')
@UseGuards(AuthGuard)
export class ProjectController {

  constructor(
    private readonly _logger: AppLogger,
    private readonly _github: GithubService
  ) { }

  @Get("/exists/:name")
  public async projectExists(@Param("name") name: string) {
    if (!!await Project.findOne({ where: { name } })) {
      throw new BadRequestException("This project name already exists");
    }
  }

  @Get("/check-bot-github")
  public async checkProjectGithubLink(@Query("link") link: string) {
    return await this._github.verifyInstallation(link) && !await Project.findOne({ where: { githubLink: link.toLowerCase() }});
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
  public async createProject(@Body() projectReq: CreateProjectDto, @CurrentUser() user: User) {
    const project = await Project.findOne({ where: { githubLink: projectReq.githubLink.toLowerCase() }});
    if (project)
      throw new BadRequestException("This repository has already been registered");
    return await Project.create({
      creator: user,
      ...projectReq,
      githubLink: projectReq.githubLink.toLowerCase(),
      type: projectReq.type == "nginx" ? ProjectType.NGINX : ProjectType.PHP,
      repoId: await this._github.getRepoId(projectReq.githubLink),
      phpInfo: projectReq.type == "php" ? PhpInfo.create({ env: projectReq.env }) : null,
      mysqlInfo: projectReq.mysqlEnabled ? new MysqlInfo(projectReq.name) : null,
      nginxInfo: NginxInfo.create({ rootDir: projectReq.rootDir, rootDirSha: projectReq.rootDirSha }),
      collaborators: [...(await User.find({ where: { studentId: projectReq.addedUsers } })).map(user => Collaborator.create({
        user,
        role: Role.COLLABORATOR
      })), Collaborator.create({ user, role: Role.OWNER })]
    }).save();
  }

}
