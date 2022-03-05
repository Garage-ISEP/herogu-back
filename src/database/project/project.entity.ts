import { NginxInfo } from './nginx-info.entity';
import { PhpInfo } from './php-info.entity';
import { Collaborator } from '../collaborator/collaborator.entity';
import { User } from '../user/user.entity';
import { Column, CreateDateColumn, JoinColumn, ManyToOne, OneToMany, OneToOne, RelationId, UpdateDateColumn } from 'typeorm';
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MysqlInfo } from './mysql-info.entity';
import { AppEntity } from '../app.entity';


export enum ProjectType {
  NGINX = "NGINX",
  PHP = "PHP",
}
@Entity()
export class Project extends AppEntity {

  @PrimaryGeneratedColumn("uuid")
  public id: string;

  @Column({ unique: true })
  public name: string;

  @Column({ unique: true })
  public githubLink: string;

  @Column("text", { nullable: true, array: true })
  public shas?: string[];

  @Column({ type: "int", nullable: true })
  public installationId: number;

  @Column({ type: "enum", enum: ProjectType })
  public type: ProjectType;

  @OneToOne(() => MysqlInfo, mysqlInfo => mysqlInfo.project, { nullable: true, cascade: ["insert", "recover", "update", "remove"], eager: true })
  public mysqlInfo?: MysqlInfo;

  @OneToOne(() => PhpInfo, phpInfo => phpInfo.project, { nullable: true, cascade: ["insert", "recover", "update", "remove"], eager: true })
  public phpInfo?: PhpInfo;

  @OneToOne(() => NginxInfo, nginxInfo => nginxInfo.project, { cascade: ["insert", "recover", "update", "remove"], eager: true })
  public nginxInfo: NginxInfo;

  @Column()
  public notificationsEnabled: boolean;

  @Column({ nullable: true})
  public lastBuild?: Date;

  @Column({ nullable: true })
  public storageOverageDate?: Date;

  @Column({ default: false })
  public storageWarned: boolean;

  @ManyToOne(() => User, { cascade: ["insert", "recover", "update"], eager: true })
  @JoinColumn()
  public creator: User;

  @RelationId((project: Project) => project.creator)
  public creatorId: string;

  @OneToMany(() => Collaborator, collaborator => collaborator.project, { cascade: ["insert", "recover", "update", "remove"], onDelete: "CASCADE", eager: true })
  @JoinColumn({ referencedColumnName: "projectId" })
  public collaborators: Collaborator[];

  @CreateDateColumn()
  public createdDate: Date;

  @UpdateDateColumn()
  public updatedDate: Date;

  public get mysqlEnabled() {
    return !!this.mysqlInfo;
  }
}