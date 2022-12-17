
FROM node:18.12-alpine as builder

WORKDIR /app

COPY . .

RUN yarn

RUN yarn run build



FROM node:18.12-alpine

WORKDIR /app

EXPOSE 3000

COPY package.json .

COPY --from=builder /app /app

CMD ["yarn", "run", "start:prod"]