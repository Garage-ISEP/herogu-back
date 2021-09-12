import { Injectable, OnModuleInit } from '@nestjs/common';
import { createAppAuth, OAuthAppAuthentication } from '@octokit/auth-app';
import { readFile } from "fs/promises";
@Injectable()
export class GithubService implements OnModuleInit {
  
  private _authInfo: OAuthAppAuthentication;

  public async onModuleInit() {
    this._authInfo = await createAppAuth({
      appId: process.env.GITHUB_ID,
      privateKey: (await readFile("../../github-private-key.pem")).toString(),
      clientId: process.env.GITHUB_CLIENT,
      clientSecret: process.env.GITHUB_SECRET,
    })({ type: "oauth-app" });
  }

}
