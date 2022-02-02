import { Injectable, Logger, Module } from '@nestjs/common';

@Injectable()
export class AppLogger extends Logger {

  info(...message: any[]) {
    super.log(message.join(" "), this.getCaller());
  }
  log(...message: any[]) {
    super.log(message.join(" "), this.getCaller());
  }
  warn(...message: any[]) {
    super.warn(message.join(" "), this.getCaller());
  }
  debug(...message: any[]) {
    super.debug(message.join(" "), this.getCaller())
  }
  verbose(...message: any[]) {
    super.verbose(message.join(" "), this.getCaller());
  }
  error(...message: any[]) {
    super.error(message.slice(0, -1).join(" "), message[message.length - 1], this.getCaller());
  }

  private getCaller(): string {
    const error = new Error();
    let stackLine = 3;
    try {
      throw error;
    } catch (e) {
      const stack = e.stack.split("\n");
      const line: string = stack[stackLine];
      const className: string = line.match(/([A-Z])\w+/g)?.[0] || "<anonymous>";
      let methodName: string = line.match(/(?<=\.)(.+)(?= )/gi)?.[0] || "<anonymous>";
      if (line.match(/new ([A-Z])\w+/g))
        methodName = "constructor";
      return `${className}::${methodName}`;
    }
  }
}