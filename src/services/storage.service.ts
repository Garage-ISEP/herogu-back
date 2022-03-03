import { ProjectRepository } from 'src/database/project/project.repository';
import { Project } from '../database/project/project.entity';
import { DockerService } from 'src/services/docker.service';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from 'src/utils/app-logger.util';
import { MailerService } from './mailer.service';
import { DockerDf } from 'src/models/docker/docker-df.model';

/**
 * Handle storage overflow and deletion of projects
 */
@Injectable()
export class StorageService implements OnModuleInit {

  private readonly storageLimit = +process.env.CONTAINER_RW_LIMIT;
  private readonly strStorageLimit = Math.ceil(+process.env.CONTAINER_RW_LIMIT / 1000000) + "MB";
  constructor(
    private readonly _logger: AppLogger,
    private readonly _mailer: MailerService,
    private readonly _docker: DockerService,
    private readonly _projectRepo: ProjectRepository,
  ) { }

  public onModuleInit() {
    this._logger.log("Starting storage watchdog");
    // Checking storage every 15 minutes
    setInterval(() => this.checkStorage().catch(e => this._logger.error(e)), 60_000 * 15);
    this.checkStorage().catch(e => this._logger.error(e));
  }

  /**
   * We check all the herogu projects and alert the user if the storage limit is reached
   */
  private async checkStorage() {
    const containers = await this._docker.getContainersDataUsage();
    // Projects with alerts
    const storageActivityProjects = await this._projectRepo.getProjectWithStorageIssues();
    this._logger.log("Checking storage limits");
    for (const container of containers) {
      const name = this.getContainerName(container);
      // If the project is more than 150% of the storage limit, we instant reset it
      if (container.SizeRw >= this.storageLimit * 1.5)
        await this.resetProject(container, name);
      else if (container.SizeRw >= this.storageLimit) {                                       // If the project is above the storage limit
        const project = storageActivityProjects.find(p => p.name === name);
        if (!project || !project.storageOverageDate)                                          // If the project is not already in the warned list
          await this.enableStorageTimeout(container, name);                                   // We enable a timeout
        else if (project.storageOverageDate.getTime() + (1000 * 60 * 60 * 48) < Date.now())   // If the projec is in the warned list and that it reached the timeout of 48h
          await this.resetProject(container, name);                                           // We reset the project
      }
      else if (container.SizeRw >= this.storageLimit * 0.9)                                   // If the project is below the storage limit but above 90%      
        await this.alertStorageLimit(container, name);                                        // We send a warning mail to all colalborators
      else {
        const project = storageActivityProjects.find(p => p.name === name)
        if (project && project.storageOverageDate)                                            // If the project is in the timeout list but is below 90%
          await this.disableStorageTimeout(project);                                          // We disable the timeout
        if (project && project.storageWarned && container.SizeRw <= this.storageLimit * 0.8)  // If the project is in the warned list but is below 80%
          await this.reEnableStorageLimit(project);                                           // We re-enable the storage limit (it means that the client will be re-notified)
      }
    }
  }

  /**
   * Set a project storage timeout on the project because the project has exceeded the storage limit
   */
  private async enableStorageTimeout(container: DockerDf.Container, name: string) {
    const project = await this._projectRepo.findOne({ where: { name } });
    const percentage = ((container.SizeRw / this.storageLimit) * 100).toFixed(0);
    const size = Math.ceil(container.SizeRw / 1000000) + "MB";
    if (project) {
      this._logger.log(`Enabling storage timeout for project ${name}`);
      project.storageOverageDate = new Date();
      const futureDate = new Date(Date.now() + (1000 * 60 * 60 * 48));
      const strFutureDate = `${futureDate.getDate()}/${futureDate.getMonth() + 1}/${futureDate.getFullYear()} à ${futureDate.getHours()}:${futureDate.getMinutes()}`;
      await project.save();
      await this._mailer.sendMailToProject(project, `
        Ton projet ${name} à atteint sa limite de stockage il sera supprimé dans 48h (le ${strFutureDate}) si la limite ne descend pas en dessous de 100%<br/>
        Quota : ${size}/${this.strStorageLimit}, ${percentage}% d'utilisation<br/>
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
    const project = await this._projectRepo.findOne({ where: { name } });
    const percentage = ((container.SizeRw / this.storageLimit) * 100).toFixed(0);
    const size = Math.ceil(container.SizeRw / 1000000) + "MB";
    if (project && !project.storageWarned) {
      this._logger.log(`Alerting storage limit for project ${name}`);
      await this._mailer.sendMailToProject(project, `
          Ton projet ${name} va bientôt atteindre sa limite de stockage !<br/>
          Quota : ${size}/${this.strStorageLimit}, ${percentage}% d'utilisation<br/>
          En cas de dépassement ton projet sera réinitialisé dans les 48h suivantes.<br/>
          En cas de dépassement de plus de 150% de la limite, ton projet sera instantanément réinitialisé<br/>
      `);
      project.storageWarned = true;
      await project.save();
    } else if (!project) {
      this._logger.log(`Project ${name} not found but should be alerted due to exceeding storage limit`);
    }
  }

  private async reEnableStorageLimit(project: Project) {
    this._logger.log(`Re-enabling storage limit for project ${project.name}`);
    project.storageWarned = false;
    await project.save();
  }

  /**
   * Remove container and volumes of project
   */
  private async resetProject(container: DockerDf.Container, name: string) {
    const project = await this._projectRepo.findOne({ where: { name }, relations: ["collaborators"] });
    const percentage = ((container.SizeRw / this.storageLimit) * 100).toFixed(0);
    if (project) {
      try {
        this._logger.log(`Removing project container ${name} due to storage limits (${percentage}%)`);
        await this._docker.removeContainerFromName(project.name, true);
        project.storageOverageDate = null;
        project.storageWarned = false;
        await project.save();
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
