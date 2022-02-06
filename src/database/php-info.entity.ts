import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Project } from "./project.entity";

export enum PhpLogLevel {
  All = 'E_ALL',
  Warning = 'E_ALL & ~E_NOTICE & ~E_DEPRECATED & ~E_STRICT',
  Error = 'E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED & ~E_STRICT',
  None = '~E_ALL',
}

@Entity()
export class PhpInfo extends BaseEntity {

  @OneToOne(() => Project, { primary: true })
  @JoinColumn()
  public project: Project;

  @Column({ enum: PhpLogLevel, default: PhpLogLevel.All })
  public logLevel: PhpLogLevel;

  @Column({ default: true })
  public logEnabled: boolean;

  @Column("json", { default: "{}" })
  public env: { [key: string]: string };
}