import { UserRepository } from './../../database/user/user.repository';
import { AppLogger } from 'src/utils/app-logger.util';
import { AuthGuard } from './../../guards/auth.guard';
import { Body, Controller, ForbiddenException, Get, InternalServerErrorException, Post, UseGuards } from '@nestjs/common';
import { User } from 'src/database/user/user.entity';
import { LoginDto, LoginResponse } from './auth.dto';
import * as jwt from "jsonwebtoken";
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { SsoService } from 'src/services/sso.service';
import { InjectRepository } from '@nestjs/typeorm';
@Controller('auth')
export class AuthController {

  constructor(
    private readonly _sso: SsoService,
    private readonly _logger: AppLogger,
        private readonly _userRepo: UserRepository
  ) { }

  @Get("me")
  @UseGuards(AuthGuard)
  public async getUser(@CurrentUser() user: User): Promise<User> {
    return user;
  }

  /**
   * Login the user if it is in the database, to verify the password it uses the SSO API
   * If the user is not in the database, its will be get from SSO API and then registered
   */
  @Post('login')
  // @Recaptcha()
  public async login(@Body() creds: LoginDto): Promise<LoginResponse> {
    if (!process.env.ALLOWED_USERS.split(',').includes(creds.studentId))
      throw new ForbiddenException("You are not allowed to login");
    let user = await this._userRepo.getOne(creds.studentId);
    const token = await this._sso.login(creds.studentId, creds.password);
    if (!user) {
      const ssoUser = await this._sso.getUser(token);
      user = await this._userRepo.create({
        firstName: ssoUser.prenom,
        lastName: ssoUser.nom,
        mail: ssoUser.mail,
        id: creds.studentId
      }).save();
    }
    try {
      return new LoginResponse(jwt.sign(user.id, process.env.JWT_SECRET), user);
    } catch (e) {
      this._logger.log("Error during login", e);
      throw new InternalServerErrorException("Error during login");
    }
  }
}
