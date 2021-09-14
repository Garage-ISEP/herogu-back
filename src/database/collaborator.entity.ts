import { Project } from './project.entity';
import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

export enum Role {
  OWNER = "OWNER",
  COLLABORATOR = "COLLABORATOR"
}

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

  @Column({ type: "enum", enum: Role })
  public role: Role;
}

