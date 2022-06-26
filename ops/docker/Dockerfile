ARG NODE_ENV="production"
ARG INSTALL_EXTRA_ARGS="--omit=dev"
ARG RUNTIME_BASE_IMAGE="gcr.io/distroless/nodejs"

FROM node:18 as prod-deps

ENV NODE_ENV=${NODE_ENV}
WORKDIR /opt/alfred

RUN apt-get update && apt-get install -y python3 python-is-python3 make g++

COPY package.json package-lock.json ./
RUN npm ci $INSTALL_EXTRA_ARGS

FROM prod-deps as builder
WORKDIR /opt/alfred

RUN npm ci --prefer-offline

COPY src src
COPY tsconfig.json .

RUN npm run bundle

FROM ${RUNTIME_BASE_IMAGE}:18

ENV NODE_ENV=${NODE_ENV}
WORKDIR /opt/alfred

COPY --from=prod-deps /opt/alfred/node_modules node_modules
COPY --from=builder /opt/alfred/dist dist

COPY package.json package-lock.json tsconfig.json ./
COPY src src


CMD ["dist/alfred.js"]