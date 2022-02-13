import { Project } from './../database/project.entity';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { AppLogger } from 'src/utils/app-logger.util';
const mailConf = require("../../mail.conf.json");
@Injectable()
export class MailerService implements OnModuleInit {
  
  private readonly _transporter = createTransport({
    host: "smtp.gmail.com",
    port: mailConf?.port,
    auth: {
      type: 'OAuth2',
      user: mailConf?.mail,
      serviceClient: mailConf?.client_id,
      privateKey: mailConf?.private_key
    },
  });

  constructor(private readonly _logger: AppLogger) {}

  public async onModuleInit() {
    try {
      this._logger.log("Checking mail server configuration...");
      if (!mailConf)
        throw new Error("Mail configuration not found");
      await this._transporter.verify();
      this._logger.log("Mail server configuration OK");
		} catch(e) {
			this._logger.error("Mail error during verification", e);
    }
    return this;
  }

  public async sendMailToProject(project: Project, message: string) {
    try {
      await this._transporter.sendMail({
        from: mailConf.mail,
        to: project.collaborators.map(c => c.user.mail).join(","),
        subject: `[${project.name}] Notification Herogu`,
        html: `
          <h1 style='text-align: center'>Notification Herogu</h1>
          <p>${message}</p>
          <br>
          <br>
          <p>Cordialement,</p>
          <p>Garage</p>
        `
      });
    } catch (e) {
      this._logger.error("Error sending mail !", e);
    }
  }
}