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
  public dockerImgLink: string;

  @Column()
  public lastBuild: Date;

  @ManyToOne(() => User, { cascade: ["insert", "recover", "update"] })
  @JoinColumn()
  public creator: User;

  @OneToMany(() => Collaborator, collaborator => collaborator.project, { cascade: true })
  public collaborators: Collaborator[];
}