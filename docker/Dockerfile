
FROM node:15-alpine as builder

## Install build toolchain, install node deps and compile native add-ons
RUN apk add --no-cache python make g++

WORKDIR /app

COPY . .

RUN npm it typescript -g

RUN npm it --legacy-peer-deps

RUN npm run build

RUN npm prune --production


FROM node:15-alpine

WORKDIR /app

EXPOSE 3000

COPY package.json .

COPY --from=builder /app /app

CMD ["npm", "run", "start:prod"]