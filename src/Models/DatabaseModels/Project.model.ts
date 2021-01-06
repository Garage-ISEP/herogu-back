import { Table, Column, Model, HasMany, DataType, Default, ForeignKey, BelongsTo, BelongsToMany, PrimaryKey, AutoIncrement, Unique } from 'sequelize-typescript';
import { User, Collaborator } from '../DatabaseModels';

@Table
export class Project extends Model<Project> {

  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  id: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER })
  userId: number;

  @Unique
  @Column({ type: DataType.STRING(255) })
  name: string;

  @Unique
  @Column({ type: DataType.STRING(255) })
  docker_img_link: string;

  @Column({ type: DataType.DATE })
  last_build: Date;

  @BelongsTo(() => User)
  user: User;

  @BelongsToMany(() => User, () => Collaborator)
  collaborators: User[];
  
}
