import { MysqlInfo } from 'src/database/mysql-info.entity';
import { AppLogger } from 'src/utils/app-logger.util';
import { DockerService } from 'src/services/docker.service';
import { Injectable, OnModuleInit } from "@nestjs/common";
import { NoMysqlContainerException, ProjectCreationException, ProjectDeletionException } from 'src/errors/docker.exception';
import { DbCredentials } from 'src/models/docker/docker-container.model';
import { generatePassword } from 'src/utils/string.util';
import { map, Observer } from 'rxjs';

@Injectable()
export class MysqlService implements OnModuleInit {

  constructor(
    private readonly _docker: DockerService,
    private readonly _logger: AppLogger
  ) { }

  public async onModuleInit() {
    try {
      this._logger.log("Checking Mysql container...");
      await this._docker.getMysqlContainerInfo();
      this._logger.log("Mysql container is running");
    } catch (e) {
      this._logger.error("Mysql container not started", e);
    }
  }

  public async checkMysqlConnection(dbName: string, username: string, password: string): Promise<boolean> {
    try {
      await this._mysqlQuery("SELECT 1;", dbName, username, password);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
 * Create a mysql db with user
 * An optional sql fileName can be provided to hydrate the db 
 */
  public async createMysqlDBWithUser(creds: MysqlInfo): Promise<MysqlInfo> {
    try {
      await this._mysqlQuery(`CREATE DATABASE IF NOT EXISTS ${creds.database} CHARACTER SET utf8;`);
      await this._mysqlQuery(`CREATE USER IF NOT EXISTS '${creds.user}' IDENTIFIED BY '${creds.password}';`);
      await this._mysqlQuery(`GRANT ALL ON ${creds.database}.* TO '${creds.user}';`);
      await this._mysqlQuery("FLUSH PRIVILEGES;");
      await this._mysqlQuery("CREATE TABLE IF NOT EXISTS Bienvenue (Message varchar(255));", creds.database);
      await this._mysqlQuery(`INSERT INTO Bienvenue (Message) VALUES ("Salut ! Tu peux configurer ta BDD avec le logiciel de ton choix !");`, creds.database, creds.user, creds.password);
      return creds;
    } catch (e) {
      this._logger.error(e);
      throw new ProjectCreationException("Error while Creating DB With USER");
    }
  }

  public async resetMysqlDB(creds: MysqlInfo) {
    try {
      await this.deleteMysqlDB(creds);
      await this.createMysqlDBWithUser(creds);
    } catch (e) {
      this._logger.error(e);
      throw new ProjectCreationException("Error while resetting DB");
    }
  }

  public async deleteMysqlDB(creds: MysqlInfo) {
    try {
      await this._mysqlQuery(`DROP USER IF EXISTS '${creds.user}';`);
      await this._mysqlQuery(`DROP DATABASE IF EXISTS ${creds.database};`);
    } catch (e) {
      this._logger.error(e);
      throw new ProjectDeletionException("Error while deleting DB");
    }
  }

  /**
   * Execute sql commands, for instance from a .sql file
   */
  public async execSQLFile(sql: string, dbName: string, username: string, password: string) {
    // try {
    //   if (sql) new Parser().parse(sql);      
    // } catch (e) {
    //   console.error(e);
    //   throw new ProjectCreationException("Error when parsing SQL File", 2);
    // }
    try {
      await this._mysqlQuery(sql, dbName, username, password);
    } catch (e) {
      this._logger.error(e);
      console.error(e);
      throw new ProjectCreationException("Error while adding sql to db");
    }
  }
  /**
   * Execute a SQL query
   * By default it will execute a query with root creds
   * If specified it will execute a query with the given credentials and database name
 */
  private async _mysqlQuery(str: string, dbName?: string, user = "root", password = process.env.MYSQL_PASSWORD) {
    await this._mysqlExec('mysql', `--user=${user}`, `--password=${password}`, dbName ? `-e use ${dbName};${str}` : `-e ${str}`);
  }


  /**
   * Execute bash commands in the mysql container
   * If the keyword 'error' is detected in the command response, and error is thrown
   * If the request is not just a existing database test, the mysql response is logged
   */
  private async _mysqlExec(...str: string[]) {
    const container = await this._docker.getMysqlContainer();
    return new Promise<void>(async (resolve, reject) => {
      (await this._docker.containerExec(container, ...str)).subscribe({
        complete: resolve,
        error: reject,
        next: chunk => {
          if (chunk.toString().toLowerCase().includes("error"))
            reject(`Execution error : ${str.join(" ")}, ${chunk}`);
          else if (!chunk.toString().toLowerCase().includes("warning") && !str.reduce((acc, curr) => acc + curr, " ").includes("SELECT 1;"))
            this._logger.log(`Mysql command response [${str.join(" ")}] : ${chunk.includes('\n') ? '\n' + chunk : chunk}`);
        }
      });
    });
  }
}