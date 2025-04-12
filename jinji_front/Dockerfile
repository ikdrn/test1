# Node.js ベースの Dockerfile
FROM node:18-alpine

WORKDIR /app

# npm を使用している場合は package-lock.json もコピーする
COPY package.json package-lock.json ./
RUN npm install

COPY . .

# ビルド（必要に応じ）
RUN npm run build

# ポート3000を公開
EXPOSE 3000

CMD ["npm", "start"]
