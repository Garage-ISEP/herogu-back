import { Project } from './project.entity';
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class NginxInfo extends BaseEntity {
  
  @OneToOne(() => Project, project => project.nginxInfo, { primary: true, onDelete: 'CASCADE' })
  @JoinColumn()
  public project: Project;
  
  @Column({ default: "" })
  public rootDir: string;

  @Column({ nullable: true })
  public rootDirSha: string;
}