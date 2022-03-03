import { Container } from 'dockerode';
import { MysqlInfo } from 'src/database/project/mysql-info.entity';
import { AppLogger } from 'src/utils/app-logger.util';
import { DockerService } from 'src/services/docker.service';
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ProjectCreationException, ProjectDeletionException } from 'src/errors/docker.exception';

/**
 * Handle all communication with mysql container
 * TODO: use mysql sock instead of container exec
 */
@Injectable()
export class MysqlService implements OnModuleInit {

  private _mysqlContainer: Container;
  constructor(
    private readonly _docker: DockerService,
    private readonly _logger: AppLogger
  ) { }

  public async onModuleInit() {
    try {
      this._logger.log("Checking Mysql container...");
      this._mysqlContainer = await this._docker.getMysqlContainer();
      this._logger.log("Mysql container is running");
    } catch (e) {
      this._logger.error("Mysql container not started");
    }
  }

  /**
   * Check that a given database exists and is healthy
   */
  public async checkMysqlConnection(dbName: string, username: string, password: string): Promise<boolean> {
    try {
      await this._mysqlQuery("SELECT 1;", dbName, username, password);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Create a mysql db from a given database name, username and password
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

  /**
   * Remove and recreate an empty with the same creds
   */
  public async resetMysqlDB(creds: MysqlInfo) {
    try {
      await this.deleteMysqlDB(creds);
      await this.createMysqlDBWithUser(creds);
    } catch (e) {
      this._logger.error(e);
      throw new ProjectCreationException("Error while resetting DB");
    }
  }

  /**
   * Delete a mysql database and its user
   */
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
   * Execute a SQL query through mysql cli
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
    return await new Promise<void>(async (resolve, reject) => {
      (await this._docker.containerExec(this._mysqlContainer, ...str)).subscribe({
        complete: resolve,
        error: reject,
        next: chunk => {
          if (chunk.toString().toLowerCase().includes("error"))
            reject(`Execution error : ${str.join(" ")}, ${chunk}`);
          else if (!chunk.toString().toLowerCase().includes("warning") && !str.join(" ").includes("SELECT 1;"))
            this._logger.log(`Mysql command response [${str.join(" ")}] : ${chunk.includes('\n') ? '\n' + chunk : chunk}`);
        }
      });
    });
  }
}