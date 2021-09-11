import { InternalServerErrorException } from "@nestjs/common";

export class ProjectCreationException extends InternalServerErrorException {
  constructor(message: string) {
    super({ reason: message });
  }
}

export class ProjectStartingException extends InternalServerErrorException {
  constructor(message: string) {
    super({ reason: message });
  }
}

export class ProjectStoppingException extends InternalServerErrorException {
  constructor(message: string) {
    super({ reason: message });
  }
}