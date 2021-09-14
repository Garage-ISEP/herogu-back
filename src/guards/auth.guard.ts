import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import * as jwt from "jsonwebtoken";
import { User } from 'src/database/user.entity';
import { Request } from "../types/global";

@Injectable()
export class AuthGuard implements CanActivate {
  public async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest() || context.switchToWs().getClient().req;
    const token = (request.headers?.authorization || request.query?.authorization).toString().substr(7);
    try {
      const studentId = jwt.verify(token, process.env.JWT_SECRET);
      (request.meta ??= {}).user = await User.findOne({ where: { studentId }, relations: ["collaborators", "collaborators.project"] });
    } catch (e) { return false; }
    return true;
  }
}
