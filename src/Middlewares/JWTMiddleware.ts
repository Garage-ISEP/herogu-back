import { ExpressMiddlewareInterface } from 'routing-controllers';
import * as jwt from "jsonwebtoken";

import {Logger} from '../Utils/Logger.service';

export default class JWTMiddleware implements ExpressMiddlewareInterface {

  private _logger = new Logger(this);

  async use(req: any, res: any, next?: (err?: any) => any) {
    const token = <string>req.headers["auth"]
    let jwtPayload: any;
    try {
      jwtPayload = await <any>jwt.verify(token, process.env.JWT_SECRET);
    }
    catch (e) {
      res.status(401);
      res.send(JSON.stringify({
        "httpCode": 401,
        "status": "failed",
        "message": "incorect token"
      }));
      this._logger.info("Unidentified user tried to reach a page", req);
      return;
    }

    const uid: string = jwtPayload.uid;
    const mail: string = jwtPayload.mail;

    const newToken = jwt.sign({ uid, mail }, process.env.JWT_SECRET, {
      expiresIn: "1h"
    });

    res.setHeader("token", newToken);

    next();
  }

}