import { Table, Column, Model, HasMany, DataType, Default, ForeignKey, BelongsTo, PrimaryKey, AutoIncrement, Unique } from 'sequelize-typescript';
import { User, Project } from '../DatabaseModels';

@Table
export class Collaborator extends Model<Collaborator> {

  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  id: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER })
  userId: number;

  @ForeignKey(() => Project)
  @Column({ type: DataType.INTEGER })
  projectId: number;
  
}
