import { User } from '../database/user/user.entity';
import { Request as ExpressRequest } from "express";
import * as dockerodePrev from 'dockerode';

export interface Request extends ExpressRequest {
  meta: { user?: User, [key: string]: any };
}

declare namespace Dockerode {
  interface ImageBuildOptions extends dockerodePrev.ImageBuildOptions {
    version: number;
  }
}