import { Param, Body, Get, Post, Patch, Delete, Redirect, HttpCode, OnNull, JsonController, HttpError, UseBefore, Authorized, CurrentUser } from 'routing-controllers';
import { User, Project } from '../Models/DatabaseModels';
import { CreateProjectRequest } from './RequestValidator'


import { Logger } from '../Utils/Logger.service';

@JsonController()
export class ProjectController {

  private readonly _logger = new Logger(this);

  @Get('/projects/all')
  @Authorized()
  @OnNull(500)
  async getAll() {
    try {
      const projects = await Project.findAll();
      return JSON.stringify(projects);
    }
    catch (e) {
      this._logger.error(e);
      return null;
    }
  }

  @Get('/projects/:id')
  @Authorized()
  @OnNull(500)
  async getOne(@Param('id') id: string) {
    try {
      const projects = await Project.findOne({ where: { id } })
      return projects !== null ? JSON.stringify(projects) : new HttpError(400, "Invalid Id");
    }
    catch (e) {
      this._logger.error(e);
      return null
    }
  }

  @Get('/projects')
  async getUserProjects(@CurrentUser({ required: true }) user: User) {
    
  }

  @OnNull(500)
  @Post('/projects')
  async post(@Body({ required: true }) project: CreateProjectRequest) {
    try {
      if (await Project.count({ where: { docker_img_link: project.docker_img_link } }) !== 0) {
        return new HttpError(400, "This image is already used by an other project");
      }
    }
    catch (e) {
      this._logger.error(e);
      return null;
    }
    // Creer projet
  }

}
