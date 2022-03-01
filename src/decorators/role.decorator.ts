import { SetMetadata } from '@nestjs/common';
import { Role } from '../database/collaborator/collaborator.entity';

export const SetRole = (...roles: Role[]) => SetMetadata('role', roles);