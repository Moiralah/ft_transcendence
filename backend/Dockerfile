FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 4000
CMD sh -c "rm -rf src/generated && npx prisma generate && npm run start:dev"
