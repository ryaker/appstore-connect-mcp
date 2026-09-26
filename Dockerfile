FROM node:slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY . .
# Containers must listen on all interfaces; outside one the server binds to localhost.
ENV HOST=0.0.0.0
EXPOSE 3000
USER node
CMD ["node", "/app/dist/src/index.js"]