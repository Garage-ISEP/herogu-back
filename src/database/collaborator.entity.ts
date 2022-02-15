import { Project } from './project.entity';
import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

export enum Role {
  OWNER = "OWNER",
  COLLABORATOR = "COLLABORATOR"
}

@Entity()
export class Collaborator extends BaseEntity {

  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => Project, { cascade: ["insert", "recover", "update"], onDelete: "CASCADE" })
  public project: Project;

  @RelationId((collaborator: Collaborator) => collaborator.project)
  public projectId: string;

  @ManyToOne(() => User, { cascade: ["insert", "recover", "update"], onDelete: "CASCADE", eager: true })
  @JoinColumn()
  public user: User;

  @Column()
  public userId: string;

  @Column({ type: "enum", enum: Role })
  public role: Role;

  @CreateDateColumn()
  public createdDate: Date;

  @UpdateDateColumn()
  public updatedDate: Date;
}

