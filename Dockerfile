FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY index.html admin.html styles.css script.js server.js logo.svg ./
COPY public ./public
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
