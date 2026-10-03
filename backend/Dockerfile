FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 4000
CMD sh -c "rm -rf src/generated && npx prisma generate && npm run start:dev"

# Production target — not used by local `make up`/`make security` (docker-compose.yml
# pins `target: dev` explicitly and bind-mounts source over this anyway). Used by
# docker-compose.prod.yml. No bind mount here: source is copied in and built once,
# not live-reloaded.
FROM node:22-alpine AS prod
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN rm -rf src/generated && npx prisma generate && npm run build
EXPOSE 4000
CMD ["node", "dist/main.js"]
