import { Project } from './project.entity';
import { BaseEntity, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Collaborator extends BaseEntity {

  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => Project, { cascade: ["insert", "recover", "update"] })
  @JoinColumn()
  public project: Project;

  @ManyToOne(() => User, { cascade: ["insert", "recover", "update"] })
  @JoinColumn()
  public user: User;
}