import { InternalServerErrorException } from "@nestjs/common";

export class ProjectCreationException extends InternalServerErrorException {
  constructor(message: string) {
    super({ reason: message, code: 0 });
  }
}

export class ProjectStartingException extends InternalServerErrorException {
  constructor() {
    super({ code: 1 });
  }
}

export class ProjectStoppingException extends InternalServerErrorException {
  constructor() {
    super({ code: 2 });
  }
}