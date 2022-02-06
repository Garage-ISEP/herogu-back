import { Project } from './project.entity';
import { BaseEntity, Column, Entity, OneToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class NginxInfo extends BaseEntity {
  
  @PrimaryGeneratedColumn()
  public id: number;

  @OneToOne(() => Project, project => project.nginxInfo, { primary: true })
  public project: Project;
  
  @Column({ default: "" })
  public rootDir: string;

  @Column({ nullable: true })
  public rootDirSha: string;
}