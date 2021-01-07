import { BadRequestError, ExpressMiddlewareInterface, InternalServerError, Body } from 'routing-controllers';
import axios from 'axios';

import {Logger} from '../Utils/Logger.service'

export default class CaptchaMiddleware implements ExpressMiddlewareInterface {

  private _logger = new Logger(this);

  async use(req: any, res: any, next?: (err?: any) => any) {
    this._logger.log(req.body);
    const captchaToken = req.body.captchaToken;
    if (!captchaToken) {
      throw new BadRequestError("Capcha Token is required");
    }
    let gglres: any;
    try {
      gglres = await axios.post('https://www.google.com/recaptcha/api/siteverify', {
        secret: process.env.GGL_CAPTCHA_SECRET,
        response: captchaToken
      });
    }
    catch (e) {
      throw new InternalServerError("Capcha validation failed")
    }
    this._logger.log(gglres);
    if (gglres.success === false) {
      throw new BadRequestError("Recapcha failed")
    }
    next();
  }

}