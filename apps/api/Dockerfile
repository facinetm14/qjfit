FROM node:20.15.0-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
RUN npm install
RUN npm run prisma:generate --workspace @qjfit/api

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps ./apps
RUN npm run build --workspace @qjfit/api

FROM node:20.15.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S qjfit && adduser -S qjfit -G qjfit
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json ./apps/api/package.json
USER qjfit
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
