# ベースイメージ
FROM golang:1.20-alpine

# 作業ディレクトリ作成
WORKDIR /app

# モジュールファイルとソースコードをコピー
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# バイナリビルド
RUN go build -o jinji_app .

# ポート公開（環境に合わせ変更）
EXPOSE 8080

# アプリ実行
CMD ["./jinji_app"]
