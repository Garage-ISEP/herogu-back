import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import * as jwt from "jsonwebtoken";
import { User } from 'src/database/user.entity';
import { Request } from "../types/global";

@Injectable()
export class AuthGuard implements CanActivate {
  public async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest() || context.switchToWs().getClient().req;
    const token = (request.headers?.authorization || request.query?.authorization).toString();
    const userId = jwt.decode(token);
    request.meta.user = await User.findOne({ where: { userId } });
    if (!request.meta.user) return false;
    try {
      jwt.verify(token, request.meta.user.id);
    } catch (e) { return false; }
    return true;
  }
}
