FROM node:15-alpine

WORKDIR /app

COPY . .

RUN npm it typescript -g

RUN npm it

RUN npm run build

EXPOSE 3000

CMD npm start