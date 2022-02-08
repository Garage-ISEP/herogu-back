import { Project, ProjectType } from './../database/project.entity';
import { DockerService } from './docker.service';
import { Injectable } from "@nestjs/common";

/**
 * @description Service for managing configuration inside docker containers such as mysql or php options
 */
@Injectable()
export class ConfigService {

  constructor(
    private readonly _docker: DockerService,
  ) { }

  /**
   * @description Update the Nginx http root path from the project configuration
   * @summary Change the Nginx Configuration and reload the service
   */
  public async updateHttpRootDir(project: Project) {
    //We remove leading slash with substring and we escape all '/' to '\/'
    const path = project.nginxInfo.rootDir.substring(1).replace(/\//g, '\\/');
    await this._sedCommand(project.name,
      '/etc/nginx/nginx.conf',
      `s/[ \\t]*root \\/var\\/www\\/html\\/.*;/\\t\\troot \\/var\\/www\\/html\\/${path};/g`
    );
    if (project.type !== ProjectType.NGINX)
      await this._docker.asyncContainerExec(project.name, 'rc-service', 'nginx', 'reload');
    else
      await this._docker.asyncContainerExec(project.name, 'nginx', '-s', 'reload');
  }

  /**
   * @description Update the PHP log level from the project configuration
   * @summary Change the PHP Configuration and restart the service
   */
  public async updatePhpLogLevel(project: Project) {
    await this._replacePhpIniValues(project.name, {
      'error_reporting': project.phpInfo.logLevel.toString(),
      'display_errors': project.phpInfo.logEnabled ? "On" : "Off"
    });
    await this._docker.asyncContainerExec(project.name, 'rc-service', 'php-fpm8', 'reload');
  }

  /**
   * @description Replace a values from keys in the php.ini file and escape the '&' char for the sed command
   * @description Note: The '\' char should also be escaped if needed
   * @see https://unix.stackexchange.com/questions/32907/what-characters-do-i-need-to-escape-when-using-sed-in-a-sh-script
   * @param containerName the name of the container
   * @param entries the key/value pairs to replace
  */
  private async _replacePhpIniValues(projectName: string, entries: { [key: string]: string }) {
    for (const key in entries)
      entries[key] = entries[key].replace(/\&/g, '\\&');  //The '\' is escaped 2 times for the string input and the sed command
      
    await this._sedCommand(projectName,
      '/etc/php8/php.ini',
      ...Object.entries(entries).map(([key, value]) => `s/^[^;]*${key} =.*/${key} = ${value}/g`)
    );
  }

  /**
   * @description execute multiple sed regex commands on the container and file given
   * @param projectName The name of the container
   * @param file The file to edit
   * @param commands The command list to execute
   */
  private async _sedCommand(projectName: string, file: string, ...commands: string[]) {
    await this._docker.asyncContainerExec(
      projectName, 'sed', '-i',
      ...commands.map(command => `-e ${command}`),
      file
    );
  }

} 