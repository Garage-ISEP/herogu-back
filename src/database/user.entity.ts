import { Project } from './project.entity';
import { Collaborator } from './collaborator.entity';
import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";

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

  @Column({ unique: true, type: "varchar", length: 9 })
  public studentId: string;

  @Column({ default: false })
  public admin: boolean;

  @OneToMany(() => Collaborator, collaborator => collaborator.user, { cascade: ["update"] })
  public collaborators: Collaborator[];
}