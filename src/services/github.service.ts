import { Injectable, OnModuleInit } from '@nestjs/common';
import { App } from 'octokit';
import { readFile } from "fs/promises";
import { AppLogger } from 'src/utils/app-logger.util';
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
  
  public async addConfiguration(url: string, content: string, repoId: number) {
    const [owner, repo] = url.split("/").slice(-2);
    // const repoInstallation = await this._client.octokit.rest.apps.getRepoInstallation({ owner: "Totodore", repo: "1942" });
    const octokit = await this._client.getInstallationOctokit(repoId);
    await octokit.rest.repos.createOrUpdateFileContents({
      path: ".github/workflows/herogu-ci.yml",
      message: "Adding Herogu continuous integration configuration",
      owner,
      repo,
      content
    });
  }
}
