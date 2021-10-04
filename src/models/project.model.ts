export class ProjectStatusResponse {
  constructor(
    public status: ProjectStatus,
  ) { }
}
export enum ProjectStatus {
  ERROR = "ERROR",
  IN_PROGRESS = "IN_PROGRESS",
  SUCCESS = "SUCCESS",
}