import { AppLogger } from './utils/app-logger.util';
import { Module } from '@nestjs/common';
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot(), //env configuration
    AppLogger //Custom logger
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
