import { AppLogger } from './utils/app-logger.util';
import { Module } from '@nestjs/common';
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerService } from './services/mailer.service';
import { DockerService } from './services/docker.service';
import { AuthController } from './controllers/auth/auth.controller';

@Module({
  imports: [
    ConfigModule.forRoot(), //env configuration
    AppLogger, //Custom logger
    TypeOrmModule.forRoot({   //Database configuration
      type: 'postgres',
      host: process.env.DB_HOST,
      username: process.env.DB_USER,
      password: process.env.DB_PSWD,
      database: process.env.DB_NAME,
      schema: process.env.DB_SCHEMA,
      entities: ["**/*.entity.js"],
      synchronize: process.env.NODE_ENV === "dev",
    })
  ],
  controllers: [AuthController],
  providers: [MailerService, DockerService],
})
export class AppModule {}
