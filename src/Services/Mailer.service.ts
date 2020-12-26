import { Logger } from '../Utils/Logger.service';
import { createTransport } from "nodemailer";

class Mailer {

  private readonly _transporter = createTransport({
    host: process.env.MAIL_HOST,
		auth: {
			pass: process.env.MAIL_MDP,
      user: process.env.MAIL_ADDR,
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
    this._transporter.sendMail({
      from: process.env.MAIL_ADDR,
      to: process.env.MAIL_DEST,
      subject: `Erreur Herogu : ${callerName}`,
      html: `
        <h1 style='text-align: center'>Logs : </h1>
        <p>${error.join(" ")}</p>
      `
    }).catch(e => this._logger.info("Error sending error mail"));
  }

  /**
   * Envoie un mail de vérification
   * Throw une erreur en cas de non envoie du mail
   */
  public async sendVerificationMail(email: string, code: string) {
    await this._transporter.sendMail({
      to: email,
      from: process.env.MAIL_ADDR,
      subject: "Vérification mail Herogu",
      html: `
        Pour vérifier votre mail, cliquez sur ce lien : <br>
        <a href='${process.env.BASE_URL}/verify?token=${code}'>lien</a>
      `
    }).catch(e => { throw new Error("Error sending verification mail") });
  }
}

export default new Mailer();