import "reflect-metadata";
import { Action, InternalServerError, UnauthorizedError } from 'routing-controllers';
import { JWTSocketMiddleware } from './Middlewares/SocketJWTMiddleware';
import { LogsController } from './Controllers/Sockets/Logs.controller';
import { useExpressServer } from 'routing-controllers';
import { useSocketServer } from 'socket.io-ts-controllers';
import * as cors from "cors";
import * as express from "express";
import { Sequelize } from 'sequelize-typescript';
import { Dialect } from 'sequelize/types';

import * as jwt from "jsonwebtoken";

import { User, Role, Project } from "./Models/DatabaseModels";

const sequelize = new Sequelize({
  logging: false,
  host: process.env.DB_HOST ?? "localhost",
  database: process.env.DB_NAME ?? "herogu",
  dialect: <Dialect>process.env.DB_DIALECT ?? "postgres",
  username: process.env.DB_USER ?? "root",
  password: process.env.DB_PSWD ?? "root",
  define: {
    schema: process.env.DB_SCHEMA ?? "herogu"
  },
  models: [User, Role, Project]
});

const app = express();

useExpressServer(app, {
  cors: {
    origin: '*',
  },
  controllers: [__dirname + '/Controllers/*.js'],
  authorizationChecker: async (action: Action) => {
    const token = action.request.headers["auth"]
    let jwtPayload: any;
    // Read jwt token from header
    try {
      jwtPayload = await <any>jwt.verify(token, process.env.JWT_SECRET);
    }
    catch (e) {
      throw new UnauthorizedError("Invalid token");
    }

    const uid: string = jwtPayload.uid;
    let user: any;
    // Get user by studentId from DB
    try {
      user = await User.findOne({ where: { studentId: uid }, include: [Role], attributes: { exclude: ['hash_pswd'] } });
    }
    catch (e) {
      throw new InternalServerError("DB Failing");
    }
    // Check Role
    try {
      return user.role.name === "ADMIN";
    }
    catch (e) {
      throw new InternalServerError("Can't retreive User from request");
    }
  },
  currentUserChecker: async (action: Action) => {
    const token = action.request.headers["auth"]
    let jwtPayload: any;
    // Read JWT token from header
    try {
      jwtPayload = await <any>jwt.verify(token, process.env.JWT_SECRET);
    }
    catch (e) {
      throw new UnauthorizedError("Invalid token");
    }

    const uid: string = jwtPayload.uid;
    let user: any;
    // Get user by studentId
    try {
      user = await User.findOne({ where: { studentId: uid }, include: [Role], attributes: { exclude: ['hash_pswd'] } });
      if (user.verified === true) {
        return user;
      }
      else {
        return;
      }
    }
    catch (e) {
      throw new InternalServerError("DB Failing");
    }
  },
});

const server = require("http").Server(app);
const io = require("socket.io")(server);

useSocketServer(io, {
  controllers: [LogsController],
  middlewares: [JWTSocketMiddleware]
});

server.listen(3000, async () => {
  await sequelize.sync({force:false});
  console.log("server running on", process.env.BASE_URL);
});