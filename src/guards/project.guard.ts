import { Collaborator } from '../database/collaborator/collaborator.entity';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from 'src/database/collaborator/collaborator.entity';
import { Project } from 'src/database/project/project.entity';
import { Request } from "../types/global";
import { In } from 'typeorm';
import { User } from 'src/database/user/user.entity';
import { CollaboratorRepository } from 'src/database/collaborator/collaborator.repository';
import { InjectRepository } from '@nestjs/typeorm';

/**
 * Protect any route that requires the user to be in a given project /:projectId/...
 * Use controller default roles or method specific roles
 */
@Injectable()
export class ProjectGuard implements CanActivate {

  constructor(
    private readonly _reflector: Reflector,
    private readonly _collabRepo: CollaboratorRepository
  ) { }
  public async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest() || context.switchToWs().getClient().req;
    const id: string = request.params.id || request.params.project;
    const roles = this._reflector.get<Role[]>('role', context.getHandler()) || this._reflector.get<Role[]>('role', context.getClass())
    try {
      if (request.meta.user?.admin)
        return true;
      return await this._collabRepo.exists(id, request.meta.user.id, roles);
    } catch (e) { console.error(e); return false; }
  }
}
