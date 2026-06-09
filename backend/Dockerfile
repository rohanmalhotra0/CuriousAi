FROM node:20-slim
WORKDIR /app
COPY package*.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/
RUN npm install
COPY shared ./shared
COPY backend ./backend
WORKDIR /app/backend
EXPOSE 4000
CMD ["npm", "run", "start"]
