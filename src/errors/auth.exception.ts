import { ForbiddenException } from "@nestjs/common";

export class ToManyResendMailException extends ForbiddenException {
  constructor() {
    super({ code: 0 });
  }
}