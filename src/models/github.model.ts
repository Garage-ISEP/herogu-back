export interface GetContentResponse {
  type: string;
  encoding: string;
  size: number;
  name: string;
  path: string;
  content: string;
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
  download_url: string;
}

export type WorkflowRunStatus = "none" | "success" | "in_progress" | "failure" | { id: number };