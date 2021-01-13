FROM node:15-alpine

WORKDIR /app

COPY . .

RUN npm install && npm install typescript -g

RUN tsc

EXPOSE 3000

CMD npm start