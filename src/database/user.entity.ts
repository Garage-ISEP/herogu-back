import { Project } from './project.entity';
import { Collaborator } from './collaborator.entity';
import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class User extends BaseEntity {
  

  @PrimaryColumn({ type: "varchar", length: 9 })
  public id: string;
  
  @Column()
  public firstName: string;

  @Column()
  public lastName: string;

  @Column({ unique: true })
  public mail: string;

  @Column({ default: false })
  public admin: boolean;

  @OneToMany(() => Collaborator, collaborator => collaborator.user, { cascade: ["update"] })
  public collaborators: Collaborator[];

  @CreateDateColumn()
  public createdDate: Date;

  @UpdateDateColumn()
  public updatedDate: Date;
}