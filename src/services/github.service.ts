import { ProjectType } from './../database/project.entity';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { App, Octokit } from 'octokit';
import { readFile } from "fs/promises";
import * as yaml from "yaml";
import * as fs from "fs/promises";
import { AppLogger } from 'src/utils/app-logger.util';
import * as sodium from "tweetsodium";
import { interval, Observable } from 'rxjs';
import { map } from "rxjs/operators";
import { WorkflowRunStatus, GetContentResponse } from 'src/models/github.model';
@Injectable()
export class GithubService implements OnModuleInit {
  
  private _client: App;

  constructor(
    private readonly _logger: AppLogger,
  ) { }

  public async onModuleInit() {
    this._client = new App({
      appId: process.env.GITHUB_ID,
      privateKey: (await readFile("github-private-key.pem")).toString(),
    });
    try {
      this._logger.log("Checking Github App connection...");
      await this._client.octokit.rest.apps.getAuthenticated();
      this._logger.log("Github App connection OK");
    } catch (e) {
      this._logger.error("Github App connection failed", e);
    }
  }
  
  public async getRepoId(url: string) {
    const [owner, repo] = url.split("/").slice(-2);
    const repoInstallation = await this._client.octokit.rest.apps.getRepoInstallation({ owner, repo });
    return repoInstallation.data.id;
  }
  /**
   * Create the repo and returns the lists of shas generated from the files
   */
  public async addOrUpdateConfiguration(url: string, repoId: number, type: ProjectType, accessToken: string): Promise<string[]> {
    const [owner, repo] = url.split("/").slice(-2);
    
    const octokit = await this._client.getInstallationOctokit(repoId);
    const res = await Promise.all([
      this._addFiles(octokit, owner, repo, type),
      this._addConfiguration(octokit, owner, repo, accessToken)
    ]);
    return res[0];
  }

  public async verifyInstallation(url: string) {
    const [owner, repo] = url.split("/").slice(-2);
    try {
      return !!await this._client.octokit.rest.apps.getRepoInstallation({ owner, repo });
    } catch (e) {
      return false;
    }
  }

  public async getBuildingActionStatus(url: string, repoId: number): Promise<Observable<WorkflowRunStatus>> {
    const [owner, repo] = url.split("/").slice(-2);
    try {
      const octokit = await this._client.getInstallationOctokit(repoId);
      const workflows = await octokit.rest.actions.listWorkflowRunsForRepo({ owner, repo });
      return new Observable(observer => {
        if (workflows.data.total_count === 0)
          return observer.next("none");
        const status = workflows.data.workflow_runs[0].status;
        const conclusion = workflows.data.workflow_runs[0].conclusion;
        if (status === "completed" && conclusion === "success")
          return observer.next("success");
        else if (status === "completed" && conclusion !== "success")
          return observer.next("failure");
        else if (status === "in_progress" || status === "queued") {
          observer.next({ id: workflows.data.workflow_runs[0].id });
          const interval = setInterval(async () => {
            const workflowRun = await octokit.rest.actions.getWorkflowRun({ owner, repo, run_id: workflows.data.workflow_runs[0].id });
            if (workflowRun.data.status === "completed" && workflowRun.data.conclusion === "success") {
              observer.next("success");
              clearInterval(interval);
              observer.complete();
            } else if (workflowRun.data.status === "completed" && workflowRun.data.conclusion !== "success") {
              observer.next("success");
              clearInterval(interval);
              observer.complete();
            } else observer.next("in_progress");
          }, 1500);
        }
      });
    } catch (e) {
      console.error(e);
      return new Observable(observer => observer.next("none"));
    }
  }

  /**
   * Verify the configuration from the different shas
   */
  public async verifyConfiguration(url: string, repoId: number, shas: string[]) {
    const octokit = await this._client.getInstallationOctokit(repoId);
    const previousShas = await this._getFilesShas(octokit, url);
    for (const sha of previousShas.values()) {
      if (!shas.includes(sha))
        return false;
    }
    return true;
  }

  /**
   * Get the previous shas of the files registered on github
   * @returns a map with the shas of the files
   */
  private async _getFilesShas(octokit: Octokit, url: string): Promise<Map<string, string>>;
  private async _getFilesShas(octokit: Octokit, owner: string, repo: string): Promise<Map<string, string>>
  private async _getFilesShas(octokit: Octokit, urlOrOwner: string, repo?: string): Promise<Map<string, string>> {
    let owner = "";
    if (!repo) {
      [owner, repo] = urlOrOwner.split("/").slice(-2);
    } else owner = urlOrOwner;
    const files = [];
    try {
      files.push(...(await octokit.rest.repos.getContent({ owner, repo, path: "docker" })).data as any as GetContentResponse[]);
    } catch (e) {
      console.error(e);
     }
    try {
      files.push(...(await octokit.rest.repos.getContent({ owner, repo, path: ".github/workflows" })).data as any as GetContentResponse[]);
    } catch (e) {
      console.error(e);
      
    }
    return new Map(files.map(file => [file.path, file.sha]));
  }

  /**
   * The configuration files are added to the repository
   * Github continuous integration workflow in yaml
   * The Dockerfile (with a custom LABEL)
   * The container configuration file
   * @returns The shas of the files added
   */
  private async _addFiles(octokit: Octokit, owner: string, repo: string, type: ProjectType): Promise<string[]> {
    const doc = yaml.parse((await fs.readFile("./conf/herogu-ci.yml")).toString());
    doc.env.IMAGE_NAME = repo;

    let dockerfile = (await fs.readFile(`./conf/Dockerfile.${type.toLowerCase()}`)).toString();
    dockerfile += `\nLABEL org.opencontainers.image.source https://github.com/${owner}/${repo}`;
    const config = (await fs.readFile(`./conf/${type === ProjectType.NGINX ? "nginx.conf" : "php.ini"}`)).toString("base64");
    const previousShas = await this._getFilesShas(octokit, owner, repo);
    try {
      const res = await Promise.all([
        octokit.rest.repos.createOrUpdateFileContents({
          path: ".github/workflows/herogu-ci.yml",
          message: "Adding Herogu continuous integration configuration",
          owner,
          sha: previousShas.get(".github/workflows/herogu-ci.yml"),
          repo,
          content: Buffer.from(yaml.stringify(doc)).toString("base64"),
        }),
        octokit.rest.repos.createOrUpdateFileContents({
          path: "docker/Dockerfile",
          message: "Adding Herogu deployment and containerisation configuration",
          owner,
          sha: previousShas.get("docker/Dockerfile"),
          repo,
          content: Buffer.from(dockerfile).toString("base64"),
        }),
        octokit.rest.repos.createOrUpdateFileContents({
          path: `docker/${type === ProjectType.NGINX ? "nginx.conf" : "php.ini"}`,
          message: "Adding Herogu deployment and containerisation configuration",
          owner,
          sha: previousShas.get(`docker/${type === ProjectType.NGINX ? "nginx.conf" : "php.ini"}`),
          repo,
          content: config,
        })
      ]);
      return res.map(el => el.data.content.sha);
    } catch (e) {
      console.error(e);
      throw new Error("Error adding files to repo");
    }
  }

  /**
   * The two secrets for deployment are added to the repository
   * Deploy URL: where to ping in order to deploy the application,
   * CR_PAT: The secret in order to publish the image
   */
  private async _addConfiguration(octokit: Octokit, owner: string, repo: string, accessToken: string): Promise<void> {
    try {
      const publicKey = (await octokit.request('GET /repos/{owner}/{repo}/actions/secrets/public-key', {
        owner,
        repo
      })).data;
      const encryptedDeployUrl = Buffer.from(sodium.seal(
        Buffer.from(`http://deploy.herogu.garageisep.com/deploy/${repo}`),
        Buffer.from(publicKey.key, 'base64')
      )).toString("base64");
      const encryptedAccessToken = Buffer.from(sodium.seal(
        Buffer.from(accessToken),
        Buffer.from(publicKey.key, 'base64')
      )).toString("base64");
      Promise.all([
        octokit.rest.actions.createOrUpdateRepoSecret({
          owner,
          repo,
          secret_name: "DEPLOY_WEBHOOK_URL",
          encrypted_value: encryptedDeployUrl.toString(),
          key_id: publicKey.key_id
        }),
        octokit.rest.actions.createOrUpdateRepoSecret({
          owner,
          repo,
          secret_name: "CR_PAT",
          encrypted_value: encryptedAccessToken,
          key_id: publicKey.key_id
        })
      ]);
    } catch (e) {
      console.error(e);
      throw new Error("Error adding configuration");
    }
  }
}
