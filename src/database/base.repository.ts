import { Repository, BaseEntity, ObjectID, Brackets, ObjectLiteral, FindOneOptions, SelectQueryBuilder, FindConditions } from 'typeorm';
export class BaseRepository<T extends BaseEntity> extends Repository<T> {

  public async entityExists(where: FindConditions<T>[] | FindConditions<T> | ObjectLiteral | string): Promise<boolean> {
    return await this.createQueryBuilder().select().where(where).getCount() > 0;
  }

  public async removeOne(id: string | number | Date | ObjectID): Promise<T> {
    return await (await super.findOne(id)).remove();
  }
}