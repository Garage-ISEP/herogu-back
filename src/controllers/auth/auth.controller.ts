import { AuthGuard } from './../../guards/auth.guard';
import { BadRequestException, Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { User } from 'src/database/user.entity';
import { LoginDto } from './login.dto';
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { ToManyResendMailException } from 'src/errors/auth.exception';
import { MailerService } from 'src/services/mailer.service';
import { RegisterDto } from './register.dto';
@Controller('auth')
export class AuthController {

  constructor(
    private readonly _mail: MailerService,
  ) { }

  @Post('login')
  public async login(@Body() creds: LoginDto): Promise<{ token: string }> {
    const user = await User.findOne({ where: { studentId: creds.studentId } });
    if (!user)
      throw new BadRequestException("This user does not exists");
    if (!await bcrypt.compare(creds.password, user.password))
      throw new ForbiddenException("Invalid password");

    return { token: jwt.sign(user.studentId, user.id) };
  }

  @Post('register')
  public async register(@Body() userReq: RegisterDto): Promise<void> {
    let user = await User.findOne({ where: { studentId: userReq.studentId } });
    if (user)
      throw new BadRequestException("User already exists");
    user = await User.create({
      ...userReq,
      password: await bcrypt.hash(userReq.password, 10),
      firstName: userReq.email.match(/^\w+/)[0] || "undefined",
      lastName: userReq.email.match(/(?:\.)\w+/)[0].replace(/\./, "") || "undefined",
    }).save();
    await this._mail.sendVerificationMail(user.mail, user.id); 
  }

  @Post('resend-mail')
  @UseGuards(AuthGuard)
  public async resendMail(@CurrentUser() user: User): Promise<void> {
    if (user.verified)
      throw new ForbiddenException("Mail already verified");
    if (user.lastVerifiedMail?.getTime() < new Date().getTime() - 120_000)
      throw new ToManyResendMailException();
    await this._mail.sendVerificationMail(user.mail, user.id);
    await User.update(user.id, { lastVerifiedMail: new Date() });
  }

  @Post('verify-mail')
  public async verifyMail(@Body("token") token: string) {
    const user = await User.findOne({ where: { id: jwt.decode(token) } });
    try {
      jwt.verify(token, user.id) as string
    } catch (e) {
      throw new BadRequestException("User does not exists");
    };
    await User.update(user.id, { verified: true });
  }
}
