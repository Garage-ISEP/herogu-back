import { BadRequestException, Body, Controller, Get, InternalServerErrorException, Param, Post, UseGuards } from '@nestjs/common';
import { Project } from 'src/database/project.entity';
import { AuthGuard } from 'src/guards/auth.guard';
import { AppLogger } from 'src/utils/app-logger.util';
import { CreateProjectDto } from './project.dto';

@Controller('project')
@UseGuards(AuthGuard)
export class ProjectController {

  constructor(
    private _logger: AppLogger,
  ) { }

  @Get("/exists/:name")
  async projectExists(@Param("name") name: string) {
    this._logger.log(name);
    if (!!await Project.findOne({ where: { name } })) {
      throw new BadRequestException("this project name already exists");
    }
  }

  @Get('/:id')
  async getOne(@Param('id') id: string) {
    return await Project.findOne(id, { relations: ["creator", "collaborators"] });
  }

  @Post('/')
  async post(@Body() project: CreateProjectDto) {
    if (await Project.count({ where: { docker_img_link: project.docker_img_link } }))
      throw new BadRequestException("this docker image link already exists");
    //TODO: Create project
  }
}
