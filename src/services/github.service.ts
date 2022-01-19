import { ProjectType } from './../database/project.entity';
import { Injectable, OnModuleInit, HttpService } from '@nestjs/common';
import { App, Octokit } from 'octokit';
import { PushEvent } from "@octokit/webhooks-types";
import { readFile } from "fs/promises";
import * as yaml from "yaml";
import * as fs from "fs/promises";
import { AppLogger } from 'src/utils/app-logger.util';
import * as sodium from "tweetsodium";
import { GetContentResponse } from 'src/models/github.model';
import { Webhooks, createNodeMiddleware } from '@octokit/webhooks';
import { HttpAdapterHost } from '@nestjs/core';
@Injectable()
export class GithubService implements OnModuleInit {
  
  private _client: App;

  constructor(
    private readonly _logger: AppLogger,
    private readonly adapterHost: HttpAdapterHost
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
    this.initWebhooks();
  }

  private initWebhooks() {
    try {
      this._logger.log("Initializing Github webhooks...");
      const webhooks = new Webhooks({ secret: process.env.GITHUB_WEBHOOK_SECRET });
      this.adapterHost.httpAdapter.use(createNodeMiddleware(webhooks, { path: "/github/event", log: this._logger }));
      this._logger.log("Github webhooks initialized");
      webhooks.on("push", e => this.onGithubPush(e.payload));
    } catch (e) {
      this._logger.error("Github webhooks initialization failed", e);
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
  public async addOrUpdateConfiguration(url: string, repoId: number, type: ProjectType): Promise<string[]> {
    const [owner, repo] = url.split("/").slice(-2);
    
    const octokit = await this._client.getInstallationOctokit(repoId);
    const res = await Promise.all([
      this._addFiles(octokit, owner, repo, type),
    ]);
    return res[0];
  }

  /**
   * Disable all workflow runs except the last one
   */
  public async disableAllWorkflowRuns(url: string, repoId: number) {
    const octokit = await this._client.getInstallationOctokit(repoId);
    const [owner, repo] = url.split("/").slice(-2);
    const workflows = await octokit.rest.actions.listWorkflowRunsForRepo({ owner, repo });
    for (const workflow of workflows.data.workflow_runs.filter((el, index) => (el.status === "queued" || el.status === "in_progress") && index !== 0)) {
      await octokit.rest.actions.cancelWorkflowRun({ owner, repo, run_id: workflow.id });
    }
  }

  public async verifyInstallation(url: string) {
    const [owner, repo] = url.split("/").slice(-2);
    try {
      return !!await this._client.octokit.rest.apps.getRepoInstallation({ owner, repo });
    } catch (e) {
      return false;
    }
  }

  public async verifyImage(url: string, repoId: number) {
    const [owner, repo] = url.split("/").slice(-2);
    try {
      const octokit = await this._client.getInstallationOctokit(repoId);
      await octokit.rest.packages.getPackageForUser({ username: owner, package_name: repo, package_type: "container" });
      return true;
    } catch (e) {
      return false;
    }
  }

  public async isLastImage(githubId: number, url: string) {
    const [owner, repo, name] = url.split(":")[0].split("/").slice(-3);
    const repoId = await this.getRepoId(url);
    const octokit = await this._client.getInstallationOctokit(repoId);
    const image = await octokit.rest.packages.getPackageForUser({ package_name: name, package_type: "container", username: owner });
    return image.data.id == githubId;
  }

  public async getInstallationToken(url: string): Promise<string> {
    const [owner, repo] = url.split("/").slice(-2);
    const installationInfo = await this._client.octokit.rest.apps.getRepoInstallation({ owner, repo });
    const octokit = await this._client.getInstallationOctokit(installationInfo.data.id);
    const data = await octokit.request(`POST https://api.github.com/app/installations/${installationInfo.data.id}/access_tokens`)
    console.log(data);
    return data.data.token;
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
    } catch (e) { }
    try {
      files.push(...(await octokit.rest.repos.getContent({ owner, repo, path: ".github/workflows" })).data as any as GetContentResponse[]);
    } catch (e) { }
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
    const doc = yaml.parse((await fs.readFile("./config/herogu-ci.yml")).toString());
    doc.env.IMAGE_NAME = repo;

    let dockerfile = (await fs.readFile(`./config/Dockerfile.${type.toLowerCase()}`)).toString();
    dockerfile += `\nLABEL org.opencontainers.image.source https://github.com/${owner}/${repo}`;
    const config = (await fs.readFile(`./config/${type === ProjectType.NGINX ? "nginx.conf" : "php.ini"}`)).toString("base64");
    const previousShas = await this._getFilesShas(octokit, owner, repo);
    try {
      const res = await Promise.all([
        // octokit.rest.repos.createOrUpdateFileContents({
        //   path: ".github/workflows/herogu-ci.yml",
        //   message: "Adding Herogu continuous integration configuration",
        //   owner,
        //   sha: previousShas.get(".github/workflows/herogu-ci.yml"),
        //   repo,
        //   content: Buffer.from(yaml.stringify(doc)).toString("base64"),
        // }),
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

  public async onGithubPush(event: PushEvent) {
    this._logger.log(`Received push event from ${event.repository.full_name}#${event.ref}`);
    //Regex that extracts the branch from the ref tag only if it is a branch and on the head of the repo
    if (event.ref.match(/(?<=heads\/)[a-zA-Z0-9._-]+$/i)?.[0] !== event.repository.default_branch)
      return;
    //TODO: Check configuration file SHA
    try {
      const token = await this.getInstallationToken(event.repository.url);
      //TODO: Ping le hook de herogu-ci avec le token
    } catch (e) {
      this._logger.error("Could not get repository access token", e);
    }
  }

  public async getMainBranch(url: string) {
    const repoId = await this.getRepoId(url);
    const octokit = await this._client.getInstallationOctokit(repoId);
    const owner = url.split("/").slice(-2, -1)[0];
    const repo = url.split("/").slice(-1)[0];
    const res = await octokit.rest.repos.get({ owner, repo });
    return res.data.default_branch;
  }

  public async getLastCommitSha(url: string) {
    const [owner, repo] = url.split("/").slice(-2);
    const octokit = await this._client.getInstallationOctokit(await this.getRepoId(url));
    const mainBranch = await this.getMainBranch(url);
    const res = await octokit.rest.repos.getCommit({ owner, repo, ref: "heads/" + mainBranch });
    return res.data.sha;
  }
}
