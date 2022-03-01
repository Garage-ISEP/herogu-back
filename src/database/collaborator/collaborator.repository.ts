import { UserRepository } from 'src/database/user/user.repository';
import { Repository, Not, EntityRepository, In } from 'typeorm';
import { BaseRepository } from '../base.repository';
import { Project } from '../project/project.entity';
import { User } from '../user/user.entity';
import { Collaborator, Role } from './collaborator.entity';

@EntityRepository(Collaborator)
export class CollaboratorRepository extends BaseRepository<Collaborator> {

  public async exists(projectId: string, userId: string, roles?: Role[]): Promise<boolean> {
    return await super.entityExists({ project: new Project(projectId), user: new User(userId), role: In(roles) });
  }

  public async updateProjectCollaborators(project: Project, userIds: string[]) {
    await this.createQueryBuilder()
      .delete().where({ project, user: Not([...userIds.map(id => new User(id)), project.creator]) })
      .insert().values(userIds.map(userId => this.create({ project, user: new User(userId), role: Role.COLLABORATOR }))).orIgnore()
      .execute();
    return [
      ...userIds.filter(id => id != project.creatorId).map(userId => this.create({ project, user: new User(userId), role: Role.COLLABORATOR })),
    ];
  }
}