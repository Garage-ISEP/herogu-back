import { Table, Column, Model, HasMany, DataType, Default, ForeignKey, BelongsTo, PrimaryKey, AutoIncrement, Unique } from 'sequelize-typescript';
import User from './User.model';

@Table
class Project extends Model<Project> {

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
  
}

export default Project;