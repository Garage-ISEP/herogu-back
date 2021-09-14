import { Collaborator } from './collaborator.entity';
import { User } from './user.entity';
import { Column, CreateDateColumn, JoinColumn, ManyToOne, OneToMany, UpdateDateColumn } from 'typeorm';
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

  @Column()
  public name: string;

  @Column()
  public githubLink: string;

  @Column("text", { nullable: true, array: true })
  public shas?: string[];

  @Column({ type: "int" })
  public repoId: number;

  @Column({ type: "enum", enum: ProjectType })
  public type: ProjectType;

  @Column()
  public mysqlUser: string;

  @Column()
  public mysqlPassword: string;

  @Column()
  public mysqlDatabase: string;

  @Column()
  public mysqlEnabled: boolean;

  @Column()
  public lastBuild: Date;

  @ManyToOne(() => User, { cascade: ["insert", "recover", "update"] })
  @JoinColumn()
  public creator: User;

  @OneToMany(() => Collaborator, collaborator => collaborator.project, { cascade: true })
  public collaborators: Collaborator[];

  @CreateDateColumn()
  public createdDate: Date;

  @UpdateDateColumn()
  public updatedDate: Date;
}