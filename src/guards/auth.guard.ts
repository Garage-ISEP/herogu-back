import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as jwt from "jsonwebtoken";
import { User } from 'src/database/user/user.entity';
import { UserRepository } from 'src/database/user/user.repository';
import { Request } from "../types/global";

@Injectable()
export class AuthGuard implements CanActivate {

  constructor(
        private readonly _userRepo: UserRepository
  ) { }
  public async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest() || context.switchToWs().getClient().req;
    const token = (request.headers?.authorization || request.query?.authorization)?.toString()?.substring(7);
    try {
      const id = jwt.verify(token, process.env.JWT_SECRET) as string;
      (request.meta ??= {}).user = await this._userRepo.getOne(id);
    } catch (e) { return false; }
    return true;
  }
}
