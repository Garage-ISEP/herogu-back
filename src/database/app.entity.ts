import { BaseEntity } from 'typeorm';
export abstract class AppEntity extends BaseEntity implements IAppEntity {

  public id?: string | number;
  constructor(data?: Partial<AppEntity> | string | number) {
    super();
    if (typeof data == "object")
      Object.assign(this, data);
    else if (data)
      this.id = data;
  }
}

interface IAppEntity {
  id?: string | number;
}