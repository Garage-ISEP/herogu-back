import { EntityRepository, In, Repository } from "typeorm";
import { BaseRepository } from "../base.repository";
import { User } from "./user.entity";

@EntityRepository(User)
export class UserRepository extends BaseRepository<User> {

  public getAll(take?: number, skip?: number, query?: string): Promise<User[]> {
    return this.find({ take, skip, relations: ["roles", "createdProjects"], where: query ? { name: query } : { } });
  }

  public getOne(id: string): Promise<User> {
    return this.findOne(id, { relations: ["collaborators", "collaborators.project"] });
  }

  public async filterUserList(userids: string[]) {
    return (await this.find({ select: ["id"], where: { id: In(userids) } })).map(user => user.id);
  }
  public async toggleAdmin(id: string) {
    await this.update(id, { admin: () => 'NOT admin' });
  }
}