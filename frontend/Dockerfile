FROM node:20-slim
WORKDIR /app
COPY package*.json ./
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/
RUN npm install
COPY shared ./shared
COPY frontend ./frontend
WORKDIR /app/frontend
EXPOSE 5173
CMD ["npm", "run", "dev"]
