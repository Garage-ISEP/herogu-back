import { Collaborator } from './collaborator.entity';
import { User } from './user.entity';
import { Column, CreateDateColumn, JoinColumn, ManyToOne, OneToMany, RelationId, UpdateDateColumn } from 'typeorm';
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from 'typeorm';


export enum ProjectType {
  NGINX = "NGINX",
  PHP = "PHP",
}
@Entity()
export class Project extends BaseEntity {

  @PrimaryGeneratedColumn("uuid")
  public id: string;

  @Column({ unique: true })
  public name: string;

  @Column({ unique: true })
  public githubLink: string;

  @Column("text", { nullable: true, array: true })
  public shas?: string[];

  @Column({ type: "int", nullable: true, unique: true })
  public repoId: number;

  @Column({ type: "enum", enum: ProjectType })
  public type: ProjectType;

  @Column({ nullable: true})
  public mysqlUser: string;

  @Column({ nullable: true})
  public mysqlPassword: string;

  @Column()
  public uniqueName: string;

  @Column()
  public mysqlEnabled: boolean;

  @Column()
  public notificationsEnabled: boolean;

  @Column({ nullable: true})
  public lastBuild?: Date;

  @Column("json", { default: "{}" })
  public env: { [key: string]: string };

  @ManyToOne(() => User, { cascade: ["insert", "recover", "update"] })
  @JoinColumn()
  public creator: User;

  @RelationId((project: Project) => project.creator)
  public creatorId: string;

  @OneToMany(() => Collaborator, collaborator => collaborator.project, { cascade: true, onDelete: "CASCADE" })
  @JoinColumn()
  public collaborators: Collaborator[];

  @CreateDateColumn()
  public createdDate: Date;

  @UpdateDateColumn()
  public updatedDate: Date;
}