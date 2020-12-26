import { JWTSocketMiddleware } from './Middlewares/SocketJWTMiddleware';
import "reflect-metadata";
import { LogsController } from './Controllers/Sockets/Logs.controller';
import { useExpressServer } from 'routing-controllers';
import { useSocketServer } from 'socket.io-ts-controllers';
import * as express from "express";
import { Sequelize } from 'sequelize-typescript';
import { Dialect } from 'sequelize/types';

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
  models: [__dirname + '/Models/DatabaseModels'],
});

const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);

useExpressServer(app, {
  controllers: [__dirname + '/Controllers/*.js'],
});

useSocketServer(io, {
  controllers: [LogsController],
  middlewares: [JWTSocketMiddleware]
});

server.listen(3000, async () => {
  await sequelize.sync({force:false});
  console.log("server running on port 3000");
});