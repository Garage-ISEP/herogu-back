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