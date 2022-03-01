import { generatePassword } from "src/utils/string.util";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { Project } from "./project.entity";

@Entity()
export class MysqlInfo extends BaseEntity {

  constructor(projectName?: string) {
    super();
    if (projectName) {
      this.database ??= generatePassword(6) + "_" + projectName.substring(0, 10).replace(/-/g, '_');
      this.user ??= generatePassword(6) + "_" + projectName.substring(0, 10).replace(/-/g, '_');
      this.password ??= generatePassword();
    }
  }

  @OneToOne(() => Project, project => project.mysqlInfo, { primary: true, onDelete: 'CASCADE' })
  @JoinColumn()
  public project: Project;

  @Column()
  public user: string;

  @Column()
  public password: string;

  @Column()
  public database: string;
}
