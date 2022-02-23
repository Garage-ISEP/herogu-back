import { Collaborator } from './../database/collaborator.entity';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from 'src/database/collaborator.entity';
import { Project } from 'src/database/project.entity';
import { Request } from "../types/global";
import { In } from 'typeorm';
import { User } from 'src/database/user.entity';

/**
 * Protect any route that requires the user to be in a given project /:projectId/...
 * Use controller default roles or method specific roles
 */
@Injectable()
export class ProjectGuard implements CanActivate {

  constructor(
    private readonly _reflector: Reflector,
  ) { }
  public async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest() || context.switchToWs().getClient().req;
    const id: string = request.params.id || request.params.project;
    const roles = this._reflector.get<Role[]>('role', context.getHandler()) || this._reflector.get<Role[]>('role', context.getClass())
    try {
      return !!await Collaborator.findOne({
        where: {
          project: Project.create({ id }),
          user: User.create({ id: request.meta.user.id }),
          role: In(roles)
        }
      });
    } catch (e) { console.error(e); return false; }
  }
}
