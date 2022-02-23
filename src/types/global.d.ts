import { User } from '../database/user/user.entity';
import { Request as ExpressRequest } from "express";

export interface Request extends ExpressRequest {
  meta: { user?: User, [key: string]: any };
}