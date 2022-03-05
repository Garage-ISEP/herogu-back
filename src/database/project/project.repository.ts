import { Injectable } from "@nestjs/common";
import { CreateProjectDto } from "src/controllers/project/project.dto";
import { EntityRepository, IsNull, Not, Repository } from "typeorm";
import { BaseRepository } from "../base.repository";
import { Collaborator, Role } from "../collaborator/collaborator.entity";
import { User } from "../user/user.entity";
import { MysqlInfo } from "./mysql-info.entity";
import { NginxInfo } from "./nginx-info.entity";
import { PhpInfo } from "./php-info.entity";
import { Project, ProjectType } from "./project.entity";

@EntityRepository(Project)
@Injectable()
export class ProjectRepository extends BaseRepository<Project> {


  public async checkIfProjectExists(name: string, githubLink: string): Promise<boolean> {
    return await this.createQueryBuilder().select().where({ name }).getCount() > 0;
  }
  public async getAll(skip?: number, take?: number, query?: string) {
    return await this.createQueryBuilder()
      .skip(skip)
      .take(take)
      .where('entity.name LIKE :query', { query: `%${query}%` })
      .getMany();
  }

  public async getProjectWithStorageIssues() {
    return this.find({
      where: [
        { storageOverageDate: Not(IsNull()) },
        { storageWarned: true }
      ],
      select: ["storageOverageDate", "name", "id", "collaborators", 'storageWarned'],
    })
  }

  public async toggleNotifications(id: string) {
    await this.createQueryBuilder()
      .update()
      .set({ notificationsEnabled: () => `NOT "notificationsEnabled"` })
      .where({ id }).execute();
  }

  public async getProjectOwnedBy(id: string) {
    return await this.createQueryBuilder('p')
      .where("p.creatorId = :id", { id })
      .getMany();
  }

  public async updateShas(id: string, shas: string[]) {
    await this.createQueryBuilder().update().set({ shas: shas }).where({ id }).execute();
    return shas;
  }

  public async createProject(req: CreateProjectDto, installationId: number, user: User) {
    return await this.create({
      creator: user,
      ...req,
      githubLink: req.githubLink.toLowerCase(),
      type: req.type == "nginx" ? ProjectType.NGINX : ProjectType.PHP,
      installationId,
      phpInfo: req.type == "php" ? PhpInfo.create({ env: req.env }) : null,
      mysqlInfo: req.mysqlEnabled ? new MysqlInfo(req.name) : null,
      nginxInfo: NginxInfo.create({ rootDir: req.rootDir, rootDirSha: req.rootDirSha }),
      collaborators: [Collaborator.create({ user, role: Role.OWNER })]
    }).save();
  }

}