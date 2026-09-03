FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
ARG NEXT_PUBLIC_ENABLE_DEV_TOOLS=false
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_ENABLE_DEV_TOOLS=$NEXT_PUBLIC_ENABLE_DEV_TOOLS
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
