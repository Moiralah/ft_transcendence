FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npx prisma generate --config=prisma.config.js
# ✅ Create index.ts so TypeScript can resolve the directory
RUN echo "export { PrismaClient } from './client';" > src/generated/index.ts
EXPOSE 4000
CMD ["npm", "run", "start:dev"]
