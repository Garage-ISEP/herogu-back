import { CurrentUser, Get, JsonController } from "routing-controllers";
import { User } from '../Models/DatabaseModels';


import { Logger } from '../Utils/Logger.service';


@JsonController()
export class ProfilController {

  private readonly _logger = new Logger(this);

  @Get('/me')
  async getMe(@CurrentUser({ required: true }) user: User) {
    return user.toJSON();
  }
}