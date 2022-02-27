import { Collaborator } from '../collaborator/collaborator.entity';
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { AppEntity } from '../app.entity';

@Entity()
export class User extends AppEntity {


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

  @Column()
  public graduatingYear: number;

  @OneToMany(() => Collaborator, collaborator => collaborator.user, { cascade: ["update"] })
  public collaborators: Collaborator[];

  @CreateDateColumn()
  public createdDate: Date;

  @UpdateDateColumn()
  public updatedDate: Date;
}