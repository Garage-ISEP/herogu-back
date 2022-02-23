import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { User } from "src/database/user/user.entity";
import * as jwt from "jsonwebtoken";

export const CurrentUser = createParamDecorator(async (data: void, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest() || ctx.switchToWs().getClient().req;
  return request.meta?.user || await User.findOne({
    where: {
      id: jwt.decode((request.headers?.authorization || request.query?.authorization).substring(7))
    },
    relations: ["collaborators", "collaborators.project"]
  });
});