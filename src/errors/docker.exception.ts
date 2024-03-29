import { InternalServerErrorException } from "@nestjs/common";

export class ProjectCreationException extends InternalServerErrorException {
  constructor(message: string, public code = 0) {
    super({ reason: message, code });
  }
}

export class ProjectDeletionException extends InternalServerErrorException {
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

export class DockerImageNotFoundException extends InternalServerErrorException {
  constructor() {
    super({ code: 4 }, "Docker image not found !");
  }
}

export class DockerContainerNotFoundException extends InternalServerErrorException {
  constructor(name?: string) {
    super({ code: 5 }, "Docker container not found with name " + name);
  }
}

export class DockerContainerRemoveException extends InternalServerErrorException {
  constructor(name?: string) {
    super({ code: 7 }, "Impossible to delete docker container with name " + name);
  }
}

export class DockerImageBuildException extends InternalServerErrorException {
  constructor(error?: Error, name?: string) {
    super({ code: 6, ...error }, "Docker image build failed with name " + name);
  }
}
export class DockerContainerNotStartedException extends InternalServerErrorException {
  constructor(name?: string) {
    super({ code: 8 }, "Docker container not started with name " + name);
  }
}