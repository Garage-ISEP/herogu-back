import { Param, Body, Get, Post, Patch, Delete, Redirect, HttpCode, OnNull, JsonController, HttpError, UseBefore, Authorized, CurrentUser, InternalServerError, BadRequestError, QueryParam, QueryParams } from 'routing-controllers';
import { User, Project } from '../Models/DatabaseModels';
import { CreateProjectRequest } from './RequestValidator'


import { Logger } from '../Utils/Logger.service';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

@JsonController("/projects")
export class ProjectController {

  private readonly _logger = new Logger(this);

  @Get('/')
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

  @Get('/manifest/:name')
  async verifyDockerImage(@Param('name') name: string) {
    const image = decodeURIComponent(name);
    try {
      const token = (await axios.get(`https://auth.docker.io/token?service=registry.docker.io&scope=repository:${image}:pull`, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Origin': 'hub.docker.com' }
      })).data?.token;
      await axios.get(`https://registry.hub.docker.com/v2/${image}/manifests/latest`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      return HttpCode(200);
    } catch (e) {
      const error: AxiosError = e;
      this._logger.error(error.response);
      throw new BadRequestError();
    }
  }

  
  @Get("/exists/:name")
  async projectExists(@Param("name") name: string) {
    this._logger.log(name);
    if (await Project.findOne({ where: { name } }) != null) {
      throw new BadRequestError("this project name already exists");
    } else {
      return HttpCode(200);
    }
  }

  @Get('/:id')
  @Authorized()
  async getOne(@Param('id') id: string) {
    try {
      const projects = await Project.findOne({ where: { id }, include: [
        { as: 'user', model: User },
        { as: 'collaborators', model: User }
      ] })
      return projects !== null ? projects.get() : new HttpError(400, "Invalid Id");
    }
    catch (e) {
      this._logger.error(e);
      throw new InternalServerError("DB Failing");
    }
  }

  @Post('/')
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
