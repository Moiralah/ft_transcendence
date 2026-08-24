FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD sh -c "npx prisma generate && npm run start:dev"
