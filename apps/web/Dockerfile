FROM node:20.15.0-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps ./apps
RUN npm run build --workspace @qjfit/web

FROM node:20.15.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S qjfit && adduser -S qjfit -G qjfit
COPY package.json ./
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/web/index.html ./apps/web/index.html
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/package.json ./apps/web/package.json
USER qjfit
EXPOSE 5173
CMD ["npm", "run", "preview", "--workspace", "@qjfit/web", "--", "--host", "0.0.0.0", "--port", "5173"]
