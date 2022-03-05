import { MysqlInfo } from 'src/database/project/mysql-info.entity';
import { AppLogger } from 'src/utils/app-logger.util';
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ProjectCreationException, ProjectDeletionException } from 'src/errors/docker.exception';
import * as mysql from "mysql2/promise";

/**
 * Handle all communication with mysql container through mysql2
 */
@Injectable()
export class MysqlService implements OnModuleInit {

  private _connection: mysql.Connection;
  constructor(
    private readonly _logger: AppLogger
  ) { }

  public async onModuleInit() {
    try {
      this._logger.log("Checking Mysql connection...");
      // We keep the root connection always alive
      this._connection = await this._getNewConnection();
      this._logger.log("Mysql connection OK");
    } catch (e) {
      this._logger.error("Mysql connection failed", e);
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
      await this._mysqlQuery([
        `CREATE DATABASE IF NOT EXISTS ${creds.database} CHARACTER SET utf8`,
        `CREATE USER IF NOT EXISTS '${creds.user}' IDENTIFIED BY '${creds.password}'`,
        `GRANT ALL ON ${creds.database}.* TO '${creds.user}'`,
        "FLUSH PRIVILEGES",
      ]);
      await this._mysqlQuery([
        "CREATE TABLE IF NOT EXISTS Bienvenue (Message varchar(255))",
        `INSERT INTO Bienvenue (Message) VALUES ("Salut ! Tu peux configurer ta BDD avec le logiciel de ton choix !")`,
      ], creds.database, creds.user, creds.password);
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
      await this._mysqlQuery([
        `DROP USER IF EXISTS '${creds.user}'`,
        `DROP DATABASE IF EXISTS ${creds.database}`
      ]);
    } catch (e) {
      this._logger.error(e);
      throw new ProjectDeletionException("Error while deleting DB");
    }
  }

  /**
   * Execute a SQL query through mysql socket
   * By default it will execute a query with root creds
   * If specified it will execute a query with the given credentials and database name
   */
  private async _mysqlQuery(str: string | string[], dbName?: string, user = "root", password = process.env.MYSQL_PASSWORD) {
    str = typeof str == "string" ? str : str.join(";");
    this._logger.log(`Executing mysql query [${user}:${password}@${dbName || 'root'}]: ${str}`);
    let co: mysql.Connection;
    try {
      if (user != "root") {
        co = await this._getNewConnection(dbName, user, password);
        await co.query(str);
      } else
        await this._connection.query(str);
    } catch (e) {
      // If the root connection crashed, we try to reconnect
      if (user == "root")
        this._connection = await this._getNewConnection();
      throw e;
    } finally {
      if (co)
        await co.end();
    }
  }

  /**
   * Initialize a new mysql connection
   * By default it will connect with root creds
   */
  private async _getNewConnection(dbName = "mysql", user = "root", password = process.env.MYSQL_PASSWORD) {
    try {
      const co = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        password,
        user,
        database: dbName,
        multipleStatements: true,
        socketPath: process.env.MYSQL_SOCK || null,
      });
      await co.connect();
      return co;
    } catch (e) {
      this._logger.error("Impossible to connect!");
      throw e;
    }
  }
}