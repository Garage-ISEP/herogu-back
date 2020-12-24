import { Logger } from '../Utils/Logger.service';
import { createTransport } from "nodemailer";

export class Mailer {

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
  
  public async sendErrorMail(caller: any, error: string) {
    const callerName = Object.getPrototypeOf(caller).constructor.name;
    this._transporter.sendMail({
      to: process.env.MAIL_DEST,
      subject: `Erreur Herogu : ${callerName}`,
      text: `
        <h1 style='text-align: center'>Logs : </h1>
        <p>${error}</p>
      `
    });
  }
}

export default new Mailer();