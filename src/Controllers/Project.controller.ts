import { Param, Body, Get, Post, Patch, Delete, Redirect, HttpCode, OnNull, JsonController, HttpError, UseBefore, Authorized, CurrentUser, InternalServerError, BadRequestError } from 'routing-controllers';
import { User, Project } from '../Models/DatabaseModels';
import { CreateProjectRequest } from './RequestValidator'


import { Logger } from '../Utils/Logger.service';

@JsonController()
export class ProjectController {

  private readonly _logger = new Logger(this);

  @Get('/projects/all')
  @Authorized()
  async getAll() {
    try {
      const projects = await Project.findAll();
      return projects.map(el => el.get());
    }
    catch (e) {
      this._logger.error(e);
      throw new InternalServerError("DB Failing");
    }
  }

  @Get('/projects/:id')
  @Authorized()
  async getOne(@Param('id') id: string) {
    try {
      const projects = await Project.findOne({ where: { id } })
      return projects !== null ? projects.get() : new HttpError(400, "Invalid Id");
    }
    catch (e) {
      this._logger.error(e);
      throw new InternalServerError("DB Failing");
    }
  }

  @Get('/projects')
  async getUserProjects(@CurrentUser({ required: true }) user: User) {
    return "heelo";
  }

  @Post('/projects')
  async post(@Body({ required: true }) project: CreateProjectRequest) {
    let c: number;
    try {
      c = await Project.count({ where: { docker_img_link: project.docker_img_link } });
    }
    catch (e) {
      this._logger.error(e);
      throw new InternalServerError("DB Failing");
    }
    if (c !== 0) {
      return new BadRequestError("This image is already used by an other project");
    }
    // Creer projet
  }

}
