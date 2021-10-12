import { AppLogger } from './utils/app-logger.util';
import { HttpModule, Module } from '@nestjs/common';
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerService } from './services/mailer.service';
import { DockerService } from './services/docker.service';
import { AuthController } from './controllers/auth/auth.controller';
import { GoogleRecaptchaModule, GoogleRecaptchaNetwork } from '@nestlab/google-recaptcha';
import { ProjectController } from './controllers/project/project.controller';
import { GithubService } from './services/github.service';
import { AdminUserController } from './controllers/admin/user/user.controller';
import { AdminProjectController } from './controllers/admin/project/project.controller';
import { SsoService } from './services/sso.service';
import { CiService } from './services/ci.service';
import { ExternalController } from './controllers/external/external.controller';

@Module({
  imports: [
    ConfigModule.forRoot(), //env configuration
    AppLogger, //Custom logger
    HttpModule,
    TypeOrmModule.forRoot({   //Database configuration
      type: 'postgres',
      host: process.env.DB_HOST,
      username: process.env.DB_USER,
      password: process.env.DB_PSWD,
      database: process.env.DB_NAME,
      schema: process.env.DB_SCHEMA,
      entities: ["**/*.entity.js"],
      synchronize: process.env.NODE_ENV === "dev",
    }),
    GoogleRecaptchaModule.forRoot({
      secretKey: process.env.RECAPTCHA_SECRET,
      response: req => req.headers.recaptcha,
      skipIf: process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'prod',
      network: GoogleRecaptchaNetwork.Recaptcha
    }),
  ],
  controllers: [AuthController, ProjectController, AdminUserController, AdminProjectController, ExternalController],
  providers: [MailerService, DockerService, GithubService, SsoService, CiService],
})
export class AppModule {}
