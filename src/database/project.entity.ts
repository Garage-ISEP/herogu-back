import { Collaborator } from './collaborator.entity';
import { User } from './user.entity';
import { Column, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from 'typeorm';

@Entity()
export class Project extends BaseEntity {

  @PrimaryGeneratedColumn("uuid")
  public id: string;

  @Column()
  public name: string;

  @Column()
  public githubLink: string;

  @Column({ nullable: true })
  public shas?: string[];

  @Column({ type: "int" })
  public repoId: number;

  @Column({ type: "enum", enum: ["nginx", "php"] })
  public type: "nginx" | "php";

  @Column()
  public mysqlUser: string;

  @Column()
  public mysqlPassword: string;

  @Column()
  public mysqlDatabase: string;

  @Column()
  public lastBuild: Date;

  @ManyToOne(() => User, { cascade: ["insert", "recover", "update"] })
  @JoinColumn()
  public creator: User;

  @OneToMany(() => Collaborator, collaborator => collaborator.project, { cascade: true })
  public collaborators: Collaborator[];
}