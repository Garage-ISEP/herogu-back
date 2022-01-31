import { Injectable, Logger, Module } from '@nestjs/common';

@Injectable()
export class AppLogger extends Logger {

  info(...message: any[]) {
    super.log(message.join(" "), "AppLogger");
  }
  log(...message: any[]) {
    super.log(message.join(" "), "AppLogger");
  }
  warn(...message: any[]) {
    super.warn(message.join(" "), "AppLogger");
  }
  debug(...message: any[]) {
    super.debug(message.join(" "), "AppLogger")
  }
  verbose(...message: any[]) {
    super.verbose(message.join(" "), "AppLogger");
  }
  error(...message: any[]) {
    super.error(message.slice(0, -1).join(" "), message[message.length - 1], "AppLogger");
  }
}