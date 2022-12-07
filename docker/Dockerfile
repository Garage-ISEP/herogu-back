
FROM node:16-alpine as builder

WORKDIR /app

COPY . .

RUN yarn

RUN yarn run build



FROM node:16-alpine

WORKDIR /app

EXPOSE 3000

COPY package.json .

COPY --from=builder /app /app

CMD ["yarn", "run", "start:prod"]