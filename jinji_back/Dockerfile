# ベースイメージ
FROM golang:1.20-alpine

# 作業ディレクトリ
WORKDIR /app

# 依存関係インストール前にプロキシ設定など必要な環境変数を設定
ENV GO111MODULE=on

# 依存関係のコピーとダウンロード
COPY go.mod .
RUN go mod download

# ソースコードのコピー
COPY . .

# アプリケーションのビルド
RUN go build -o jinji-app

# アプリケーションの実行
EXPOSE 8080
CMD ["./jinji-app"]