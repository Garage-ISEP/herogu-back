import { InternalServerErrorException } from "@nestjs/common";

export class ProjectCreationException extends InternalServerErrorException {
  constructor(message: string, public code = 0) {
    super({ reason: message, code });
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

export class NoMysqlContainerException extends InternalServerErrorException {
  constructor() {
    super({ code: 3 }, "No Mysql container found !");
  }
}