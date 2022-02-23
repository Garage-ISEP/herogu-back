import { Project } from "src/database/project/project.entity";
import { ContainerStatus } from "./docker/docker-container.model";

export class ProjectStatusResponse {
  constructor(
    public status: ProjectStatus | ContainerStatus,
    public origin: Origin,
    public exitCode?: number,
  ) { }
}
export enum ProjectStatus {
  ERROR = "ERROR",
  IN_PROGRESS = "IN_PROGRESS",
  SUCCESS = "SUCCESS",
}
export type Origin = "docker" | "mysql" | "github" | "image";

export class ProjectResponse {

  public readonly maxRwSize = +process.env.CONTAINER_RW_LIMIT;

  constructor(
    project: Project,
    public rwSize: number,
  ) {
    Object.assign(this, project);
  }
}