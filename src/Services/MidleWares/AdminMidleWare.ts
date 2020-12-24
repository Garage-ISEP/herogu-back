import { ExpressMiddlewareInterface } from 'routing-controllers';
import * as jwt from "jsonwebtoken";

import User from "../../Models/DatabaseModels/User.model";
import Role from "../../Models/DatabaseModels/Role.model";

import {Logger} from '../../Utils/Logger.service';

export default class AdminMidleware implements ExpressMiddlewareInterface {

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

    let user: any;
    const uid: string = jwtPayload.uid;

    try {
      user = await User.findOne({ where: { studentId: uid }, include: [Role] });
    }
    catch (e) {
      console.log(e)
      res.status(500);
      res.send(JSON.stringify({
        "httpCode": 500,
        "status": "failed",
        "message": "db failing"
      }));
      this._logger.error("db Failing", e);
      return;
    }

    if (user.role.name === "ADMIN") {
      next();
    } else {
      res.status(401);
      res.send(JSON.stringify({
        "httpCode": 401,
        "status": "failed",
        "message": "incorect role"
      }));
      this._logger.info("User try acces admin page", req);
      return;
    }
    
  }

}