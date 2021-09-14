import { AuthGuard } from './../../guards/auth.guard';
import { BadRequestException, Body, Controller, ForbiddenException, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { User } from 'src/database/user.entity';
import { LoginDto, LoginResponse } from './auth.dto';
import * as jwt from "jsonwebtoken";
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { ToManyResendMailException } from 'src/errors/auth.exception';
import { MailerService } from 'src/services/mailer.service';
import { Recaptcha } from '@nestlab/google-recaptcha';
import { SsoService } from 'src/services/sso.service';
@Controller('auth')
export class AuthController {

  constructor(
    private readonly _sso: SsoService,
  ) { }

  @Get("me")
  @UseGuards(AuthGuard)
  public async getUser(@CurrentUser(true) user: User): Promise<User> {
    return user;
  }

  /**
   * Login the user if it is in the database, to verify the password it uses the SSO API
   * If the user is not in the database, its will be get from SSO API and then registered
   */
  @Post('login')
  @Recaptcha()
  public async login(@Body() creds: LoginDto): Promise<LoginResponse> {
    let user = await User.findOne({ where: { studentId: creds.studentId } });
    const token = await this._sso.login(creds.studentId, creds.password);
    if (!user) {
      const ssoUser = await this._sso.getUser(token);
      user = await User.create({
        firstName: ssoUser.prenom,
        lastName: ssoUser.nom,
        mail: ssoUser.mail,
        studentId: creds.studentId
      }).save();
    }
    return new LoginResponse(jwt.sign(user.studentId, user.id), user);
  }
}
