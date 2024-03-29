import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Project } from "src/database/project/project.entity";

export const CurrentProject = createParamDecorator(async (data: void, ctx: ExecutionContext) => {
  const id = ctx.switchToHttp().getRequest().params.id;
  return Project.findOne(id, { relations: ["creator", "collaborators", "mysqlInfo", "phpInfo", "nginxInfo"] });
});