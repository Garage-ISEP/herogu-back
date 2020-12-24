import { Param, Body, Get, Post, Patch, Delete, Redirect, HttpCode, OnNull, JsonController, HttpError, UseBefore } from 'routing-controllers';
import User from '../Models/DatabaseModels/User.model';
import UserReq from '../Models/RequestModels/User.req.model'

import * as bcrypt from 'bcrypt';

import AdminMidleware from "../Services/MidleWares/AdminMidleWare";
import JWTMidleware from "../Services/MidleWares/JWTMidleWare";

import { Logger } from '../Utils/Logger.service';

@JsonController()
export class UserController {

  private readonly _logger = new Logger(this);

  @Get('/users')
  @UseBefore(JWTMidleware)
  @UseBefore(AdminMidleware)
  @OnNull(500)
  async getAll() {
    try {
      const users = await User.findAll({ attributes: { exclude: ['hash_pswd'] } });
      return JSON.stringify(users);
    }
    catch (e) {
      this._logger.error(e);
      return null;
    }
  }

  @Get('/users/:studentId')
  @UseBefore(JWTMidleware)
  @UseBefore(AdminMidleware)
  @OnNull(500)
  async getOne(@Param('studentId') studentId: string) {
    try {
      const user = await User.findOne({ where: { studentId } })
      return user !== null ? JSON.stringify(user) : new HttpError(400, "Invalid Id");
    }
    catch (e) {
      this._logger.error(e);
      return null
    }
  }

  @OnNull(500)
  @Post('/users')
  async post(@Body({ required: true }) user: UserReq) {
    try {
      if (await User.count({ where: { studentId: user.student_id } }) !== 0) {
        return new HttpError(400, "User with this studentId aleady exist");
      }
    }
    catch (e) {
      this._logger.error(e);
      return null;
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
      return null
    }
    this._logger.info("New user created : ", user);
    const verif_token = await bcrypt.hash(user.student_id + user.email, 10);
    return user;
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
