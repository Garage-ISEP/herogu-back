import { Injectable, OnModuleInit } from '@nestjs/common';
import { ContainerInspectInfo } from 'dockerode';
import { ContainerLabels } from 'src/models/docker/docker-container.model';
import { AppLogger } from 'src/utils/app-logger.util';
import { DockerService } from './docker.service';
import { GithubService } from './github.service';

@Injectable()
export class CiService {

  constructor(
    private readonly _docker: DockerService,
    private readonly _logger: AppLogger,
    private readonly _github: GithubService,
  ) { }

  /**
   * Triggered when someone call the url 
   * -Pull an image
   * -Recreate the container
   * -Prune images
   * @param id the id/name of the container to reload
   */
  public async triggerBuild(name: string) {
    let containerInfos: ContainerInspectInfo;
    let labels: ContainerLabels;

    try {
      containerInfos = await this._docker.getContainerInfoFromName(name);
      labels = containerInfos?.Config?.Labels as unknown as ContainerLabels;
      if (!labels?.['docker-ci.enable']) {
        this._logger.log("No docker ci configuration, stopping...");
        return;
      }
    } catch (e) {
      this._logger.error(null, "Impossible to get container infos " + name);
      return;
    }
    try {
      if (this._github.isLastImage(+labels['docker-ci-repoId'], labels['docker-ci.repo-url'])) {
        await this._docker.pullImage(containerInfos.Image, { username: labels['docker-ci.username'], password: labels['docker-ci.password'], serveraddress: "ghcr.io", url: containerInfos.Image, name, email: labels["docker-ci.email"], env: {} });

        await this._docker.recreateContainer(containerInfos.Id, containerInfos.Image);
      }
      else
        this._logger.info("Image already updated, no container restart needed");
    } catch (e) {
    }

    try {
      this._docker.pruneImages();
    } catch (e) {
      this._logger.error("Error removing unused images", e);
    }
  }

}
