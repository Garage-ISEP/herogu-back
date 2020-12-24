import { Table, Column, Model, HasMany, DataType, Default, ForeignKey, BelongsTo, PrimaryKey, AutoIncrement, Unique } from 'sequelize-typescript';
import User from './User.model';

@Table
class Role extends Model<Role> {

  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  id: number;

  @Column({ type: DataType.STRING(255) })
  name: string;

  @HasMany(() => User)
  users: User;
  
}

export default Role;