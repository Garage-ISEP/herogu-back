import { Body, OnNull, JsonController, HttpError, InternalServerError, BadRequestError, Post } from 'routing-controllers';
import { User } from '../Models/DatabaseModels';
import { LoginRequest } from './RequestValidator'

import * as bcrypt from 'bcrypt';
import * as jwt from "jsonwebtoken";

import { Logger } from '../Utils/Logger.service';

@JsonController("/auth")
export class AuthController {

  private readonly _logger = new Logger(this);

  @Post('/login')
  async login(@Body({ required: true }) user: LoginRequest) {
    let dbUser: User;
    try {
      dbUser = await User.findOne({ where: { studentId:user.student_id } })
    }
    catch (e) {
      this._logger.error(e);
      throw new InternalServerError("DB Failing");
    }
    if (dbUser === null) { return new HttpError(400, "Invalid Id"); }
    const hash = dbUser.hash_pswd;
    if (! await bcrypt.compare(user.password, hash)) {
      return new HttpError(401, "Incorect Password");
    }
    if (dbUser.verified === false) { 
      throw new BadRequestError("User is not verified");
    }
    const token = jwt.sign(
      { uid: dbUser.studentId, mail: dbUser.mail },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    return {
      "status": "succes",
      "token": token
    };
  }

  @Post('/verify')
  async verify(@Body({ required: true }) token: string) {
    let users: User[];
    try {
      users = await User.findAll({where: { verified: false }, attributes: { exclude: ['hash_pswd'] }})
    }
    catch (e) {
      throw new InternalServerError("DB Failing");
    }
    users.forEach(user => {
      if (bcrypt.compare(user.studentId, token)) {
        user.verified = true;
        user.save();
        return {
          "status": "succes",
          "user": user
        };
      }
    });
    throw new BadRequestError("Invalide verification token");
  }
}
