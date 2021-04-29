import { AppLogger } from './utils/app-logger.util';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot(), //env configuration
    AppLogger //Custom logger
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
