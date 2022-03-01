import { Collaborator } from 'src/database/collaborator/collaborator.entity';
import { AuthGuard } from './../../guards/auth.guard';
import { createQueryBuilder, getManager } from 'typeorm';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { User } from 'src/database/user/user.entity';
import { Project } from 'src/database/project/project.entity';
import { AdminGuard } from 'src/guards/admin.guard';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {

  @Get('/search')
  public async search(@Query("q") query?: string, @Query("filter") filter: ("project" | "user")[] = ["project", "user"]) {
    const requests: Promise<(User | Project)[]>[] = [];
    const params = { query: `%${query}%` };
    if (filter.includes("project")) {
      requests.push(createQueryBuilder(Project, 'p')
        .leftJoinAndSelect('p.creator', 'c')
        .leftJoinAndSelect('p.collaborators', 'co')
        .leftJoinAndSelect('co.user', 'u')
        .where(`p.name LIKE LOWER(:query) OR p.githubLink LIKE LOWER(:query)`, params)
        .getMany());
    }
    if (filter.includes("user")) {
      requests.push(createQueryBuilder(User, 'u')
        .leftJoinAndSelect('u.createdProjects', 'p')
        .where(`CONCAT(u.firstName, u.lastName) LIKE LOWER(:query)`, params)
        .orWhere(`u.mail LIKE LOWER(:query)`, params)
        .getMany());
    }
    return (await Promise.all(requests)).reduce((acc, cur) => [...acc, ...cur], []);
  }
}
