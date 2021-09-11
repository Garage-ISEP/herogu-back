import { Injectable, OnModuleInit } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { AppLogger } from 'src/utils/app-logger.util';
import * as mailConf from "../../mail.conf.json";
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
		} catch(e) {
			this._logger.error("Mail error during verification", e);
    }
    return this;
  }
  
  public async sendErrorMail(caller: any, ...error: any[]) {
    const callerName = Object.getPrototypeOf(caller).constructor.name;
    try {
      await this._transporter.sendMail({
        from: mailConf.mail,
        to: process.env.MAIL_ADMIN,
        subject: `Erreur Herogu : ${callerName}`,
        html: `
          <h1 style='text-align: center'>Logs : </h1>
          <p>${error.join(" ")}</p>
        `
      });
    } catch (e) {
      this._logger.error("Error sending error mail !", e);
    }
  }

  /**
   * Envoie un mail de vérification
   * Throw une erreur en cas de non envoie du mail
   */
  public async sendVerificationMail(email: string, code: string) {
    try {
      await this._transporter.sendMail({
        to: email,
        from: mailConf.mail,
        subject: "Vérification mail Herogu",
        html: `
          Pour vérifier votre mail, cliquez sur ce lien : <br>
          <a target="_blank" href='https://herogu.garageisep.com/verify?token=${code}'>lien</a>
        `
      });
    } catch (e) {
      this._logger.error(e);
      throw new Error("Error sending verification mail");
    }
  }
}