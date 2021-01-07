import { BadRequestError, ExpressMiddlewareInterface, InternalServerError } from 'routing-controllers';
import axios from 'axios';

import {Logger} from '../Utils/Logger.service'

export default class CaptchaMiddleware implements ExpressMiddlewareInterface {

  private _logger = new Logger(this);

  async use(req: any, res: any, next?: (err?: any) => any) {
   
    let capchaToken;
    try {
      if (!req.body.captchaToken) {
        throw new BadRequestError("Capcha Token is required");
      }
      capchaToken = req.body.captchaToken;
    }
    catch (e) {
      throw new BadRequestError("Capcha Token is required");
    }
    let gglres;
    try {
      gglres = await axios.post('https://www.google.com/recaptcha/api/siteverify', {
        secret: process.env.GGL_CAPTCHA_SECRET,
        response: capchaToken
      });
    }
    catch (e) {
      throw new InternalServerError("Capcha validation failed")
    }

    if (gglres.success === false) {
      throw new BadRequestError("Recapcha failed")
    }
    else {
      next();
    }
  }

}