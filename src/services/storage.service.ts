import { Project } from './../database/project.entity';
import { DockerService } from 'src/services/docker.service';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from 'src/utils/app-logger.util';
import { MailerService } from './mailer.service';
import { DockerDf } from 'src/models/docker/docker-df.model';
import { IsNull, Not } from 'typeorm';

@Injectable()
export class StorageService implements OnModuleInit {

  private readonly storageLimit = +process.env.CONTAINER_RW_LIMIT;
  constructor(
    private readonly _logger: AppLogger,
    private readonly _mailer: MailerService,
    private readonly _docker: DockerService,
  ) { }

  public onModuleInit() {
    this._logger.log("Starting storage watchdog");
    //Checking storage every 15 minutes
    setInterval(() => this.checkStorage().catch(e => this._logger.error(e)), 60_000 * 15);
    this.checkStorage().catch(e => this._logger.error(e));
  }

  /**
   * Check all the herogu projects and alert the user if the storage limit is reached
   */
  private async checkStorage() {
    const containers = await this._docker.getContainersDataUsage();
    const storageTimeoutProjects = await Project.find({
      where: {
        storageOverageDate: Not(IsNull())
      },
      select: ["storageOverageDate", "name", "id"]
    });
    this._logger.log("Checking storage limits");
    for (const container of containers) {
      const name = this.getContainerName(container);
      if (container.SizeRw >= this.storageLimit * 1.5)
        await this.resetProject(container, name);
      else if (container.SizeRw >= this.storageLimit) {
        const project = storageTimeoutProjects.find(p => p.name === name);
        if (project.storageOverageDate.getTime() < Date.now() - 1000 * 60 * 60 * 48)
          await this.enableStorageTimeout(container, name);
        else
          await this.resetProject(container, name);
      }
      else if (container.SizeRw >= this.storageLimit * 0.9)
        await this.alertStorageLimit(container, name);
      else {
        const project = storageTimeoutProjects.find(p => p.name === name)
        if (project)
          await this.disableStorageTimeout(project);
      }
    }
  }

  /**
   * Set a project storage timeout on the project because the project has exceeded the storage limit
   */
  private async enableStorageTimeout(container: DockerDf.Container, name: string) {
    const project = await Project.findOne({ where: { name } });
    const percentage = (container.SizeRw / this.storageLimit) * 100;
    if (project) {
      this._logger.log(`Enabling storage timeout for project ${name}`);
      project.storageOverageDate = new Date();
      await project.save();
      await this._mailer.sendMailToProject(project, `
        Ton projet ${name} à atteint sa limite de stockage depuis plus de 48h ou à dépassé instantanément 150% de la limite.<br/>
        Quota : ${container.SizeRw}/${process.env.CONTAINER_RW_LIMIT}, ${percentage}% d'utilisation<br/>
        Le projet à donc été réinitialisé et les données ont été supprimées.<br/>
      `);
    } else {
      this._logger.error(`Project ${name} not found but should be disabled due to exceeding storage limit`);
    }
  }

  /**
   * Disable storage timeout on the project
   */
  private async disableStorageTimeout(project: Project) {
    this._logger.log(`Disabling storage timeout for project ${project.name}`);
    try {
      project.storageOverageDate = null;
      await project.save();
    } catch (e) {
      this._logger.error("Error while disabling storage timeout on project " + project.name, e);
    }
  }


  /**
   * Send a mail to the project owner to alert him that his project is soon over the storage limit (90%)
   */
  private async alertStorageLimit(container: DockerDf.Container, name: string) {
    const project = await Project.findOne({ where: { name }, relations: ["collaborators"] });
    const percentage = (container.SizeRw / this.storageLimit) * 100;
    if (project) {
      this._logger.log(`Alerting storage limit for project ${name}`);
      await this._mailer.sendMailToProject(project, `
          Ton projet ${name} va bientôt atteindre sa limite de stockage !<br/>
          Quota : ${container.SizeRw}/${process.env.CONTAINER_RW_LIMIT}, ${percentage}% d'utilisation<br/>
          En cas de dépassement ton projet sera réinitialisé dans les 48h suivantes.<br/>
          En cas de dépassement de plus de 150% de la limite, ton projet sera instantanément réinitialisé<br/>
      `);
    } else {
      this._logger.log(`Project ${name} not found but should be alerted due to exceeding storage limit`);
    }
  }

  /**
   * Remove container and volumes of project
   */
  private async resetProject(container: DockerDf.Container, name: string) {
    const project = await Project.findOne({ where: { name }, relations: ["collaborators"] });
    const percentage = (container.SizeRw / this.storageLimit) * 100;
    if (project) {
      try {
        this._logger.log(`Removing project container ${name} due to storage limits (${percentage}%)`);
        await this._docker.removeContainerFromName(project.name, true);
        await this._mailer.sendMailToProject(project, `
          Ton projet ${name} à atteint sa limite de stockage depuis plus de 48h ou à dépassé instantanément 150% de la limite.<br/>
          Quota : ${container.SizeRw}/${process.env.CONTAINER_RW_LIMIT}, ${percentage}% d'utilisation<br/>
          Le projet à donc été réinitialisé et les données ont été supprimées.<br/>
        `);
      } catch (e) {
        this._logger.error("Error while removing project due to storage limit", e);
      }
    } else {
      this._logger.error(`Project ${name} not found but should be removed due to exceeding storage limit`);
    }
  }

  private getContainerName(container: DockerDf.Container) {
    return container.Names[0].replace(/\//g, '');
  }

}
