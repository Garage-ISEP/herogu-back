import { Table, Column, BelongsToMany, Model, HasMany, DataType, Default, ForeignKey, BelongsTo, PrimaryKey, AutoIncrement, Unique } from 'sequelize-typescript';
import { Role, Project, Collaborator } from '../DatabaseModels';


@Table
export class User extends Model<User> {

  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  id: number;

  @Column({ type: DataType.STRING(255) })
  first_name: string;

  @Column({ type: DataType.STRING(255) })
  last_name: string;

  @Column({ type: DataType.STRING(255) })
  mail: string;

  @Unique
  @Column({ type: DataType.STRING(9) })
  studentId: string;

  @Column({ type: DataType.STRING(255) })
  hash_pswd: string;

  @Default(false)
  @Column({ type: DataType.BOOLEAN })
  verified: boolean;

  @ForeignKey(() => Role)
  @Default(0)
  @Column({ type: DataType.INTEGER })
  roleId: number;

  @BelongsTo(() => Role)
  role: Role;

  @HasMany(() => Project)
  projects: Project;

  @BelongsToMany(() => Project, () => Collaborator)
  collaboratorsProjetcs: Project[];

}
