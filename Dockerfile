# Costruzione dell'applicazione
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Servizio tramite Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
# Copia il template della configurazione Nginx
# Assicurati che il tuo file locale si chiami nginx.conf.template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template


EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]