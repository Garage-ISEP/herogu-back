import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { User } from "src/database/user.entity";
import * as jwt from "jsonwebtoken";

export const CurrentUser = createParamDecorator(async (data: void, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest() || ctx.switchToWs().getClient().req;
  return request.user || await User.findOne({
    where: {
      userId: jwt.decode(request.headers?.authorization || request.query?.authorization)
    },
    relations: ["collaborators", "createdProjects", "role"]
  });
});