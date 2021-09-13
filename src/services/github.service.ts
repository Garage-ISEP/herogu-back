import { Injectable, OnModuleInit } from '@nestjs/common';
import { App, Octokit } from 'octokit';
import { readFile } from "fs/promises";
import * as yaml from "yaml";
import * as fs from "fs/promises";
import * as sodium from "tweetsodium";
import { AppLogger } from 'src/utils/app-logger.util';
import cryptoRandomString from "crypto-random-string";
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
  public async addOrUpdateConfiguration(url: string, repoId: number, type: "nginx" | "php"): Promise<string[]> {
    const [owner, repo] = url.split("/").slice(-2);
    
    const octokit = await this._client.getInstallationOctokit(repoId);
    const res = await Promise.all([
      this._addFiles(octokit, owner, repo, type),
      this._addConfiguration(octokit, owner, repo)
    ]);
    return res[0];
  }

  /**
   * Verify the configuration from the different shas
   */
  public async verifyConfiguration(url: string, shas: string[]) {
    const [owner, repo] = url.split("/").slice(-2);
    const files = [
      ...(await this._client.octokit.rest.repos.getContent({ owner, repo, path: "docker" })).data as any as GetContentResponse[],
      ...(await this._client.octokit.rest.repos.getContent({ owner, repo, path: ".github" })).data as any as GetContentResponse[],
    ]
    for (const file of files) {
      if (!shas.includes(file.sha))
        return false;
    }
  }

  /**
   * The configuration files are added to the repository
   * Github continuous integration workflow in yaml
   * The Dockerfile (with a custom LABEL)
   * The container configuration file
   * @returns The shas of the files added
   */
  private async _addFiles(octokit: Octokit, owner: string, repo: string, type: "nginx" | "php"): Promise<string[]> {
    const doc = yaml.parseDocument((await fs.readFile("./conf/herogu-ci.yml")).toString());
    doc.set("env.IMAGE_NAME", repo);

    let dockerfile = (await fs.readFile(`./conf/Dockerfile.${type}`)).toString();
    dockerfile += `\nLABEL org.opencontainers.image.source ${repo}`;

    const config = (await fs.readFile(`./conf/${type === "nginx" ? "nginx.conf" : "php.ini"}`)).toString();
    const res = await Promise.all([
      octokit.rest.repos.createOrUpdateFileContents({
        path: ".github/workflows/herogu-ci.yml",
        message: "Adding Herogu continuous integration configuration",
        owner,
        repo,
        content: doc.toString()
      }),
      octokit.rest.repos.createOrUpdateFileContents({
        path: "docker/Dockerfile",
        message: "Adding Herogu deployment and containerisation configuration",
        owner,
        repo,
        content: dockerfile
      }),
      octokit.rest.repos.createOrUpdateFileContents({
        path: `docker/${type === "nginx" ? "nginx.conf" : "php.ini"}`,
        message: "Adding Herogu deployment and containerisation configuration",
        owner,
        repo,
        content: config,
      })
    ]);
    return res.map(el => el.data.content.sha);
  }

  /**
   * The two secrets for deployment are added to the repository
   * Deploy URL: where to ping in order to deploy the application,
   * CR_PAT: The secret in order to publish the image
   */
  private async _addConfiguration(octokit: Octokit, owner: string, repo: string): Promise<void> {
    const deployUrlKey = Buffer.from(cryptoRandomString({ length: 16, type: "base64" }));
    const deployUrl = sodium.seal(
      Buffer.from(`http://deploy.herogu.garageisep.com/deploy/${repo}`),
      deployUrlKey
    );
    Promise.all([
      octokit.rest.actions.createOrUpdateRepoSecret({
        owner,
        repo,
        secret_name: "DEPLOY_WEBHOOK_URL",
        encrypted_value: deployUrl.toString(),
        key_id: deployUrlKey.toString()
      }),
      octokit.rest.actions.createOrUpdateRepoSecret({
        owner,
        repo,
        secret_name: "CR_PAT",
        encrypted_value: deployUrl.toString(),
        key_id: deployUrlKey.toString()
      })
    ]);
  }
}
