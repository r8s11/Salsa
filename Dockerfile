# Salsa Segura — production-ready container
# Multi-stage: build with Node, serve with nginx static files

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=$VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
RUN npm run build

FROM nginx:1.27-alpine AS runtime

# SPA routing: all non-asset paths fall back to index.html
# The service worker gets no-store so updates aren't pinned
RUN printf '%s\n' \
  'server {' \
  '  listen 3001;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  location /sw.js { add_header Cache-Control "no-store"; }' \
  '  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }' \
  '  location / { try_files $uri $uri/ /index.html; }' \
  '}' > /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3001
