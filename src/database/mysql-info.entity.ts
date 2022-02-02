import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { Project } from "./project.entity";

@Entity()
export class MysqlInfo extends BaseEntity {

  @PrimaryGeneratedColumn()
  public id: number;
  
  @OneToOne(() => Project, project => project.mysqlInfo, { primary: true, cascade: true, onDelete: "CASCADE" })
  public project: Project;
    
  @Column()
  public user: string;

  @Column()
  public password: string;

  @Column()
  public database: string;
}