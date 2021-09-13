import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from "../types/global";

@Injectable()
export class AdminGuard implements CanActivate {
  public async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest() || context.switchToWs().getClient().req;
    return request.meta.user.admin;
  }
}
