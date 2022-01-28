import { SsoInfo } from './../models/sso.model';
import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import qs from 'qs';
import { AppLogger } from 'src/utils/app-logger.util';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
@Injectable()
export class SsoService {

  constructor(
    private readonly _http: HttpService,
    private readonly _logger: AppLogger,
  ) { }

  public async login(username: string, password: string): Promise<string> {
    try {
      const response = await firstValueFrom(this._http.post('https://sso-portal.isep.fr', qs.stringify({ user: username, password })));
      return response.headers["set-cookie"][0].split(";").find((el: string) => el.split("=")[0] === "lemonldap").split("=")[1];
    } catch (e) {
      if (e.response.data.error == 5)
        throw new ForbiddenException("Bad credentials");
      else {
        this._logger.error("Sso error", e);
        throw new InternalServerErrorException("SSO error");
      }
    }
  }

  public async getUser(token: string): Promise<SsoInfo> {
    try {
      const response = await firstValueFrom(this._http.get<SsoInfo>(`https://sso-portal.isep.fr/session/my/global`, {
        headers: {
          Cookie: `lemonldap=${token};`
        }
      }));
      return response.data;
    } catch (e) {
      this._logger.error("Sso error", e);
      throw new InternalServerErrorException("SSO error");
    }
  }
}
