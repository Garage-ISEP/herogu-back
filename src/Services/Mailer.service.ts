import { Logger } from '../Utils/Logger.service';
import { createTransport } from "nodemailer";
//@ts-ignore
import * as gmailConf from "../../mail/gmail.conf";
class Mailer {

  private readonly _transporter = createTransport({
    host: "smtp.gmail.com",
    port: gmailConf.default.port,
    auth: {
      type: 'OAuth2',
      user: gmailConf.default.mail,
      serviceClient: gmailConf.default.client_id,
      privateKey: gmailConf.default.private_key
    },
  });

  private readonly _logger = new Logger(this);
  
  public async init(): Promise<Mailer> {
		try {
			this._logger.log("Checking mail server configuration...");
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
        from: gmailConf.default.mail,
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
        from: gmailConf.default.mail,
        subject: "Vérification mail Herogu",
        html: `
          Pour vérifier votre mail, cliquez sur ce lien : <br>
          <a target="_blank" href='${process.env.BASE_URL}/verify?token=${code}'>lien</a>
        `
      });
    } catch (e) {
      this._logger.error(e);
      throw new Error("Error sending verification mail");
    }
  }
}

export default new Mailer();
