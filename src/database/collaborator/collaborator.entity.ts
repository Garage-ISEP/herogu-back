import { Project } from '../project/project.entity';
import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { User } from '../user/user.entity';

export enum Role {
  OWNER = "OWNER",
  COLLABORATOR = "COLLABORATOR"
}

@Entity()
export class Collaborator extends BaseEntity {

  @ManyToOne(() => Project, { cascade: ["insert", "recover", "update"], onDelete: "CASCADE", primary: true })
  public project: Project;

  @RelationId((collaborator: Collaborator) => collaborator.project)
  public projectId: string;

  @ManyToOne(() => User, { cascade: ["insert", "recover", "update"], onDelete: "CASCADE", eager: true, primary: true })
  @JoinColumn()
  public user: User;

  @RelationId((collaborator: Collaborator) => collaborator.user)
  public userId: string;

  @Column({ type: "enum", enum: Role })
  public role: Role;
}

