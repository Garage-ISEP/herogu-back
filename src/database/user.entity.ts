import { Project } from './project.entity';
import { Collaborator } from './collaborator.entity';
import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Role } from "./role.entity";
import { Exclude } from 'class-transformer';

@Entity()
export class User extends BaseEntity {
  
  @PrimaryGeneratedColumn("uuid")
  public id: string;

  @Column()
  public firstName: string;

  @Column()
  public lastName: string;

  @Column({ unique: true })
  public mail: string;

  @Column({ unique: true, type: "varchar", length: 6 })
  public studentId: string;

  @Column()
  @Exclude()
  public password: string;

  @Column("boolean", { default: false })
  public verified: boolean;

  @Column({ default: false })
  public admin: boolean;

  @Column({ nullable: true })
  public lastVerifiedMail?: Date;

  @ManyToOne(() => Role)
  @JoinColumn()
  public role: Role;

  @OneToMany(() => Collaborator, collaborator => collaborator.user, { cascade: true })
  public collaborators: Collaborator[];

  @OneToMany(() => Project, project => project.creator, { cascade: ["insert", "recover", "update"] })
  public createdProjects: Project[];
}