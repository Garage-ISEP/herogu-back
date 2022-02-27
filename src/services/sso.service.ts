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

  /**
   * Loggin with the SSO portal
   * In case of bad credential throw an error
   * @returns a sso token to possibly get user infos
   */
  public async login(username: string, password: string): Promise<string> {
    try {
      const response = await firstValueFrom(this._http.post('https://sso-portal.isep.fr', qs.stringify({ user: username, password })));
      return response.headers["set-cookie"][0].match(/lemonldap=([^;]+);/)[1];
    } catch (e) {
      if (e.response.data.error == 5)
        throw new ForbiddenException("Bad credentials");
      else {
        this._logger.error("Sso error", e);
        throw new InternalServerErrorException("SSO error");
      }
    }
  }

  /**
   * Get user infos from the SSO portal
   * @param token The token from the authentified user
   * @returns A Promise with the user infos
   */
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
