FROM node:24-bookworm-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Estas variables se incorporan al código del navegador en el build.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ARG NEXT_PUBLIC_MODE=mock
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_MODE=$NEXT_PUBLIC_MODE
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
