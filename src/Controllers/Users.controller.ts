import { Param, Body, Get, Post, Patch, Delete, Redirect, HttpCode, OnNull, JsonController, HttpError, UseBefore, UseAfter, Authorized, BadRequestError, InternalServerError } from 'routing-controllers';

import { User } from '../Models/DatabaseModels';
import { CreateUserRequest } from './RequestValidator'

import CaptchaMiddleware from "../Middlewares/CaptchaMiddleware";

import * as bcrypt from 'bcrypt';
import mailer from "../Services/Mailer.service";

import { Logger } from '../Utils/Logger.service';

@JsonController()
export class UserController {

  private readonly _logger = new Logger(this);

  @Get('/users')
  @Authorized()
  async getAll() {
    try {
      const users = await User.findAll({ attributes: { exclude: ['hash_pswd'] } });
      return JSON.stringify(users);
    }
    catch (e) {
      this._logger.error(e);
      throw new InternalServerError("DB Failing");
    }
  }

  @Get('/users/:studentId')
  @Authorized()
  async getOne(@Param('studentId') studentId: string) {
    try {
      const user = await User.findOne({ where: { studentId } })
      return user !== null ? JSON.stringify(user) : new BadRequestError("User not found");
    }
    catch (e) {
      this._logger.error(e);
      throw new InternalServerError("DB Failing");
    }
  }

  @Post('/users')
  @UseBefore(CaptchaMiddleware)
  async post(@Body({ required: true }) user: CreateUserRequest) {
    try {
      if (await User.count({ where: { studentId: user.student_id } }) !== 0) {
        return new BadRequestError("User with this studentId aleady exist");
      }
    }
    catch (e) {
      this._logger.error(e);
      throw new InternalServerError("DB Failing");
    }
    const hashed_pswd = await bcrypt.hash(user.password, 10);
    const first_name = user.email.match(/^\w+/)[0] ?? "undefined";
    const last_name = user.email.match(/(?:\.)\w+/)[0].replace(/\./, "") ?? "undefined";
    const new_user = new User({
      first_name: first_name,
      last_name: last_name,
      mail: user.email,
      studentId: user.student_id,
      hash_pswd: hashed_pswd
    });
    try {
      await new_user.save();
    }
    catch (e) {
      this._logger.error(e, user);
      throw new InternalServerError("DB Failing");
    }
    this._logger.info("New user created : ", user);
    const verifCode = await bcrypt.hash(new_user.studentId, 10);
    try {
      mailer.sendVerificationMail(new_user.mail, verifCode);
    }
    catch (e) {
      this._logger.error(e, new_user)
    }
    return JSON.stringify({
      "status": "succes",
      "user": user
    });
  }

  /* @Patch('/users/:id')
  patch(@Param('id') id: number, @Body() user: any) {
    return 'Updating a user...';
  }

  @Delete('/users/:id')
  remove(@Param('id') id: number) {
    return 'Removing user...';
  } */
}
