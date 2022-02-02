import { Project, ProjectType } from './../database/project.entity';
import { DockerService } from './docker.service';
import { Injectable } from "@nestjs/common";
import strTemplate from 'string-template';
import * as fs from "fs/promises";
import { lastValueFrom } from 'rxjs';

@Injectable()
export class ConfigService {

  constructor(
    private readonly _docker: DockerService,
  ) { }

  /**
   * Update the Nginx http root path from the project configuration
   * Change the Nginx Configuration and restart the service
   */
  public async updateHttpRootDir(project: Project) {
    const dir = project.type === ProjectType.NGINX ? "nginx" : "php";
    const nginxConfig = strTemplate((await fs.readFile(`./config/${dir}/nginx.conf`)).toString(), {
      PROJECT_ROOT: project.rootDir.substring(1)  //We remove leading slash with substring
    });
    await this._updateFileInContainer(project.name, `/etc/nginx/nginx.conf`, nginxConfig);
    this._docker.containerExec(project.name, `rc-service nginx restart`);
  }
  /**
   * Update the PHP log level from the project configuration
   * Change the PHP Configuration and restart the service
   */
  public async updatePhpLogLevel(project: Project) {
    //We replace all ${} with {} for the string-template lib
    let phpConfig = (await fs.readFile(`./config/php/php.ini`)).toString().replace(/\${(?=.+})/g, '{');
    phpConfig = strTemplate(phpConfig, {
      PHP_ERROR_REPORTING: project.phpInfo.logLevel.toString(),
      PHP_DISPLAY_ERROR: project.phpInfo.logEnabled ? "On" : "Off"
    });
    await this._updateFileInContainer(project.name, `/etc/php/php.ini`, phpConfig);
    this._docker.containerExec(project.name, `rc-service php-fpm restart`);
  }


  /**
   * Update a file in a container
   * @param containerName the name of the container
   * @param filePath the path of the file to update
   * @param content the content of the file
   */
  private async _updateFileInContainer(projectName: string, filePath: string, content: string) {
    await lastValueFrom(await this._docker.containerExec(projectName, `echo "${content}" > ${filePath}`))
  }
} 