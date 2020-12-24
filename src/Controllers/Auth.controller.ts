import { Body, Post, OnNull, JsonController, HttpError } from 'routing-controllers';
import User from '../Models/DatabaseModels/User.model';
import AuthReq from '../Models/RequestModels/Auth.req.model'

import * as bcrypt from 'bcrypt';
import * as jwt from "jsonwebtoken";

import { Logger } from '../Utils/Logger.service';

@JsonController()
export class AuthController {

  private readonly _logger = new Logger(this);

  @Post('/auth/login')
  @OnNull(500)
  async login(@Body({ required: true }) user: AuthReq) {
    let dbUser: any;
    try {
      dbUser = await User.findOne({ where: { studentId:user.student_id } })
    }
    catch (e) {
      this._logger.error(e);
      return null;
    }
    if (dbUser === null) { return new HttpError(400, "Invalid Id"); }
    const hash = dbUser.hash_pswd;
    if (!bcrypt.compare(user.password, hash)) {
      return new HttpError(401, "Incorect Password");
    }
    const token = jwt.sign(
      { uid: dbUser.studentId, mail: dbUser.mail },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    return JSON.stringify({
      "status": "succes",
      "token": token
    });
  }

}
