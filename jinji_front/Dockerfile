# Node.js ベースの Dockerfile
FROM node:16-alpine

# 作業ディレクトリ
WORKDIR /app

# 依存関係のコピーとインストール
COPY package.json package-lock.json* ./
RUN npm install

# ソースコードのコピー
COPY . .

# 開発モードでアプリを起動
EXPOSE 3000
CMD ["npm", "start"]
