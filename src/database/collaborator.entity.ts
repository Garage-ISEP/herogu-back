import { Project } from './project.entity';
import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
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

  @RelationId((collaborator: Collaborator) => collaborator.project)
  public projectId: string;

  @ManyToOne(() => User, { cascade: ["insert", "recover", "update"] })
  @JoinColumn()
  public user: User;

  @RelationId((collaborator: Collaborator) => collaborator.user)
  public userId: string;

  @Column({ type: "enum", enum: Role })
  public role: Role;
}

