import { createExpressServer } from 'routing-controllers';
import "reflect-metadata";


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
  models: [__dirname + '/Models']
});


createExpressServer({
  routePrefix: '/api',
  controllers: [__dirname + '/Controllers/*.js'],
}).listen(3000, async () => {
  await sequelize.sync();
  console.log("server running...");
});