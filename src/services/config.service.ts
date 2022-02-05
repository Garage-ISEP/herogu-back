import { Project, ProjectType } from './../database/project.entity';
import { DockerService } from './docker.service';
import { Injectable } from "@nestjs/common";

@Injectable()
export class ConfigService {

  constructor(
    private readonly _docker: DockerService,
  ) { }

  /**
   * Update the Nginx http root path from the project configuration
   * Change the Nginx Configuration and reload the service
   */
  public async updateHttpRootDir(project: Project) {
    //We remove leading slash with substring
    await this._sedCommand(project.name,
      '/etc/nginx/nginx.conf',
      `s/[ \t]*root \/var\/www\/html\/.*;/\t\troot \/var\/www\/html\/${project.rootDir.substring(1)};/g`
    );
    await this._docker.asyncContainerExec(project.name, 'rc-service', 'nginx', 'reload');
  }

  /**
   * Update the PHP log level from the project configuration
   * Change the PHP Configuration and restart the service
   */
  public async updatePhpLogLevel(project: Project) {
    await this._replacePhpIniValues(project.name, {
      'error_reporting': project.phpInfo.logLevel.toString(),
      'display_errors': project.phpInfo.logEnabled ? "On" : "Off"
    });
    await this._docker.asyncContainerExec(project.name, 'rc-service', 'php-fpm8', 'reload');
  }

  /**
   * @description Replace a values from keys in the php.ini file
   * @param containerName the name of the container
   * @param entries the key/value pairs to replace
  */
  private async _replacePhpIniValues(projectName: string, entries: { [key: string]: string }) {
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