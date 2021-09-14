import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import * as jwt from "jsonwebtoken";
import { User } from 'src/database/user.entity';
import { Request } from "../types/global";

@Injectable()
export class AuthGuard implements CanActivate {
  public async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest() || context.switchToWs().getClient().req;
    const token = (request.headers?.authorization || request.query?.authorization).toString();
    try {
      const userId = jwt.verify(token, process.env.JWT_SECRET);
      request.meta.user = await User.findOne({ where: { userId } });
    } catch (e) { return false; }
    return true;
  }
}
