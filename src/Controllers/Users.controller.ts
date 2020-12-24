import { Controller, Param, Body, Get, Post, Patch, Delete, Redirect, HttpCode, OnNull, JsonController } from 'routing-controllers';
import User from '../Models/DatabaseModels/User.model';
import UserReq from '../Models/RequestModels/User.req.model'
import * as bcrypt from 'bcrypt';

import { Logger } from '../Utils/Logger.service';

@JsonController()
export class UserController {

  private readonly log = new Logger(this);

  @Get('/users')
  async getAll() {
    return await User.findAll();
  }

  @Get('/users/:studentId')
  @OnNull(400)
  async getOne(@Param('studentId') studentId: string) {
    return await User.findOne({ where: { studentId } });
  }

  @OnNull(500)
  @Post('/users')
  async post(@Body() user: UserReq) {
    console.log(user);
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
      this.log.error(e, user);
      return null
    }
    this.log.info("")
    const verif_token = await bcrypt.hash(user.student_id + user.email, 10);
    return user;
  }

  @Patch('/users/:id')
  patch(@Param('id') id: number, @Body() user: any) {
    return 'Updating a user...';
  }

  @Delete('/users/:id')
  remove(@Param('id') id: number) {
    return 'Removing user...';
  }
}
