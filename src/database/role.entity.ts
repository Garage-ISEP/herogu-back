import { User } from './user.entity';
import { BaseEntity, Column, Entity, JoinColumn, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Role extends BaseEntity {

  @PrimaryGeneratedColumn("uuid")
  public id: string;

  @Column()
  public name: string;

  @OneToMany(() => User, user => user.role)
  public users: User[]
}