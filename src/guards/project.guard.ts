import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from "../types/global";

@Injectable()
export class ProjectGuard implements CanActivate {
  public async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest() || context.switchToWs().getClient().req;
    const id = request.params.id || request.params.project;
    try {
      return !!request.meta.user.collaborators.find(proj => proj.projectId === id);
    } catch (e) { return false; }
  }
}
