import { ProjectRepository } from 'src/database/project/project.repository';
import { MailerService } from 'src/services/mailer.service';
import { Project } from 'src/database/project/project.entity';
import { ProjectType } from '../database/project/project.entity';
import { Injectable, OnModuleInit, BadRequestException, ForbiddenException } from '@nestjs/common';
import { App, Octokit } from 'octokit';
import { PushEvent } from "@octokit/webhooks-types";
import { readFile } from "fs/promises";
import * as fs from "fs/promises";
import { AppLogger } from 'src/utils/app-logger.util';
import { GetContentResponse } from 'src/models/github.model';
import { Webhooks, createNodeMiddleware } from '@octokit/webhooks';
import { HttpAdapterHost } from '@nestjs/core';
import EventSource from "eventsource";
import strTemplate from "string-template";
import { CacheMap } from 'src/utils/cache.util';
@Injectable()
export class GithubService implements OnModuleInit {

  // The github client
  private _client: App;

  // A cache for the installation ids to avoid refetching them
  private readonly _installationIdMap: CacheMap<string, number> = new CacheMap(60_000 * 10);

  // Callback for the github webhook
  public onContainerUpdate: (project: Project) => Promise<any>;

  constructor(
    private readonly _logger: AppLogger,
    private readonly _adapterHost: HttpAdapterHost,
    private readonly _mailer: MailerService,
    private readonly _projectRepo: ProjectRepository,
  ) { }

  /**
   * Authenticate the github client with a private key and check the connection
   */
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

  /**
   * Modify current nest routes to add a new dynamic route receiving all github events.
   */
  private initWebhooks() {
    try {
      this._logger.log("Initializing Github webhooks...");
      const webhooks = new Webhooks({ secret: process.env.GITHUB_WEBHOOK_SECRET });
      this._adapterHost.httpAdapter.use(createNodeMiddleware(webhooks, { path: "/github/event", log: this._logger }));
      
      // The Webhooks client can then receive push event that will trigger code
      webhooks.on("push", e => this.onGithubPush(e.payload));

      // We get all events from an EventSource dispatcher
      // Thank to that we can have multiple receivers for the same event
      const source = new EventSource(process.env.EVENT_SOURCE);
      source.onmessage = (event) => {
        const webhookEvent = JSON.parse(event.data);
        webhooks
          .verifyAndReceive({
            id: webhookEvent["x-request-id"],
            name: webhookEvent["x-github-event"],
            signature: webhookEvent["x-hub-signature"],
            payload: webhookEvent.body,
          })
          .catch(console.error);
      };
      this._logger.log("Github webhooks initialized");
    } catch (e) {
      this._logger.error("Github webhooks initialization failed", e);
    }
  }

  /**
   * @param repo A repo identifier (url or owner/repo) or an installation id to identify the installation
   * @returns An installation client 
   */
  private async _getInstallation(repo: RepoInfo | number) {
    repo = typeof repo != "number" ? await this.getInstallationId(repo) : repo;
    const installation = await this._client.getInstallationOctokit(repo);
    return installation;
  }

  /**
   * Get an installation id from a repo identifier (url or owner/repo)
   */
  public async getInstallationId(url: RepoInfo) {
    const [owner, repo] = this.getRepoFromUrl(url);
    if (this._installationIdMap.has(`${owner}/${repo}`))
      return this._installationIdMap.get(`${owner}/${repo}`);
    const repoInstallation = await this._client.octokit.rest.apps.getRepoInstallation({ owner, repo });
    this._installationIdMap.set(`${owner}/${repo}`, repoInstallation.data.id);
    return repoInstallation.data.id;
  }

  /**
   * Get a repository folder tree
   * @param url The repository identifier (url or owner/repo)
   * @param path An optional path to get the tree of (default root)
   */
  public async getRepositoryTree(url: RepoInfo, sha?: string) {
    const [owner, repo] = this.getRepoFromUrl(url);
    const octokit = await this._getInstallation(url);
    return await octokit.rest.git.getTree({ owner, repo, tree_sha: sha || await this.getLastCommitSha(url, octokit) });
  }

  /**
   * Add or update project configuration to a repository
   */
  public async addOrUpdateConfiguration(project: Project): Promise<string[]> {
    const [owner, repo] = this.getRepoFromUrl(project.githubLink);

    const octokit = await this._getInstallation(project.installationId);
    return await this._addFiles(octokit, owner, repo, project.type, project.nginxInfo.rootDir);
  }

  /**
   * Verifies the Herogu App is installed on the repository and that the main branch is not protected
   * @param url The repository identifier (url or owner/repo)
   * @returns a boolean indicating if the installation exists and is accessible
   */
  public async verifyInstallation(url: RepoInfo) {
    const [owner, repo] = this.getRepoFromUrl(url);
    try {
      const octokit = await this._getInstallation(url);
      return !(await octokit.rest.repos.getBranch({
        owner, repo,
        branch: await this.getMainBranch(url)
      })).data.protected;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get an installation token in order to execute docker git pull from a direct link.
   * (e.g https://x-access-token:${token}@github.com/${owner}/${repo}.git#${mainBranch})
   * @param url The repository identifier (url or owner/repo)
   * @returns An access token to pull the repo from a simple link
   */
  public async getInstallationToken(url: RepoInfo): Promise<string> {
    const [owner, repo] = this.getRepoFromUrl(url);
    const installationInfo = await this._client.octokit.rest.apps.getRepoInstallation({ owner, repo });
    const octokit = await this._client.getInstallationOctokit(installationInfo.data.id);
    const data = await octokit.request(`POST https://api.github.com/app/installations/${installationInfo.data.id}/access_tokens`)
    return data.data.token;
  }

  /**
   * Checks that the repository configuration hasn't been modified
   * @param url The repository identifier (url or owner/repo)
   * @param installationId The installation id
   * @param shas The shas of the files to check, if they dont match, the configuration has been modified
   */
  public async verifyConfiguration(url: string, installationId: number, shas: string[]) {
    if (!shas) return false;
    const octokit = await this._client.getInstallationOctokit(installationId);
    const previousShas = await this._getFilesShas(octokit, url);
    for (const sha of previousShas.values()) {
      if (!shas.includes(sha))
        return false;
    }
    return true;
  }

  /**
   * Get the previous shas of the files registered on github
   * @returns a map with the shas of the files and the file path in key
   */
  private async _getFilesShas(octokit: Octokit, url: RepoInfo): Promise<Map<string, string>> {
    const [owner, repo] = this.getRepoFromUrl(url);
    const files: GetContentResponse[] = [];
    try {
      files.push(...(await octokit.rest.repos.getContent({ owner, repo, path: "docker" })).data as any as GetContentResponse[]);
    } catch (e) { }
    return new Map(files.map(file => [file.path, file.sha]));
  }

  /**
   * The configuration files are added to the repository
   * The Dockerfile (with a custom LABEL)
   * The container configuration file
   * @returns The shas of the files added
   */
  private async _addFiles(octokit: Octokit, owner: string, repo: string, type: ProjectType, projectRoot = ''): Promise<string[]> {
    const dir = type === ProjectType.NGINX ? "nginx" : "php";
    let dockerfile = (await fs.readFile(`./config/${dir}/Dockerfile`)).toString();
    dockerfile += `\nLABEL org.opencontainers.image.source https://github.com/${owner}/${repo}`;
    const nginxConfig = strTemplate((await fs.readFile(`./config/${dir}/nginx.conf`)).toString(), { PROJECT_ROOT: projectRoot.substring(1) });
    const previousShas = await this._getFilesShas(octokit, [owner, repo]);
    try {
      const res = await Promise.all([
        octokit.rest.repos.createOrUpdateFileContents({
          path: "docker/Dockerfile",
          message: "Adding Herogu deployment and containerisation configuration",
          owner,
          sha: previousShas.get("docker/Dockerfile"),
          repo,
          content: Buffer.from(dockerfile).toString("base64"),
        }),
        octokit.rest.repos.createOrUpdateFileContents({
          path: `docker/nginx.conf`,
          message: "Adding Herogu deployment and containerisation configuration",
          owner,
          sha: previousShas.get(`docker/nginx.conf`),
          repo,
          content: Buffer.from(nginxConfig).toString("base64"),
        })
      ]);
      return [...(await this._getFilesShas(octokit, [owner, repo])).values()];
    } catch (e) {
      console.error(e);
      throw new Error("Error adding files to repo");
    }
  }

  /**
   * Method triggered when someone pushes to the repository
   */
  public async onGithubPush(event: PushEvent) {
    this._logger.log(`Received push event from ${event.repository.full_name}#${event.ref}`);
    // Regex that extracts the branch from the ref tag only if it is a branch and on the head of the repo
    if (event.ref.match(/(?<=heads\/)[a-zA-Z0-9._-]+$/i)?.[0] !== event.repository.default_branch)
      return;
    // Stops if the event is trigerred by the bot
    if (event.sender.login === 'herogu-app[bot]') return;
    const githubLink = `https://github.com/${event.repository.owner.login}/${event.repository.name}`.toLowerCase();
    const project = await this._projectRepo.findOne({ where: { installationId: event.installation.id, githubLink }, relations: ["nginxInfo", "phpInfo", "mysqlInfo"] });
    if (!project) {
      this._logger.log(`${event.repository.full_name}: corresponding project not found`);
      return;
    }
    try {
      this._logger.log("Starting to update project", project.name);
      // Docker image rebuild and container re-creation
      await this.onContainerUpdate(project);
      this._logger.log(`Successfully update projet ${project.name}`);
      // In case of enabled notifications we send a notification to all the project collaborators
      if (project.notificationsEnabled) {
        await this._mailer.sendMailToProject(project, `
          Le projet ${project.name} à été correctement mis à jour le ${new Date().toLocaleString()} suite au push de ${event.commits[0]?.author?.name}
        `);
      }
    } catch (e) {
      this._logger.error("Impossible to update project", project.name, e);
    }
  }

  /**
   * Get a repository main branch name
   * @param url The repository identifier (url or owner/repo)
   * @param installation An optional installation id or client to avoid refetching it
   */
  public async getMainBranch(url: RepoInfo, installation?: number | Octokit) {
    const [owner, repo] = this.getRepoFromUrl(url);
    if (!installation)
      installation = await this._getInstallation(url);
    else if (typeof installation == "number")
      installation = await this._client.getInstallationOctokit(installation);
    const res = await installation.rest.repos.get({ owner, repo });
    return res.data.default_branch;
  }

  /**
   * Get the sha (identifier) of the last git commit
   * @param url The repository identifier (url or owner/repo)
   * @param installation An optional installation id or client to avoid refetching it
   */
  public async getLastCommitSha(url: RepoInfo, installation?: number | Octokit) {
    const [owner, repo] = this.getRepoFromUrl(url);
    if (!installation)
      installation = await this._getInstallation(url);
    else if (typeof installation == "number")
      installation = await this._client.getInstallationOctokit(installation);
    const mainBranch = await this.getMainBranch(url, installation);
    const res = await installation.rest.repos.getCommit({ owner, repo, ref: "heads/" + mainBranch });
    return res.data.sha;
  }

  /**
   * Get a repo identifier from a url (owner/repo)
   */
  private getRepoFromUrl(repo: RepoInfo): [string, string] {
    if (typeof repo === "string")
      return repo.split("/").slice(-2) as [string, string];
    return repo;
  }
}
type RepoInfo = string | [string, string];
