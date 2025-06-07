##アーキテクチャ
バックエンド go(gin)
フロントエンド react+typescript
データベース neon(postgreSQL)。windowsなので環境変数でセットしておく。ハードコードしないこと。NEON_CONNECTでSetしておく。

##画面
1、ログイン画面
2、メイン画面
3、勤怠画面
4、給与画面
5、人事考課画面

##データベース
-- 社員データベース
CREATE TABLE TBL_EMPLO (
  emplid NUMERIC(5) PRIMARY KEY,
  emplps VARCHAR(60) NOT NULL, -- bcryptハッシュ化
  emplnm VARCHAR(50) NOT NULL
);

-- 勤怠データベース
CREATE TABLE TBL_ATTEN (
  atteid NUMERIC(5) NOT NULL,
  attedt DATE NOT NULL,
  attest TIME,
  atteet TIME,
  PRIMARY KEY (atteid, attedt), -- 社員番号と日付でユニークにする
  FOREIGN KEY (atteid) REFERENCES TBL_EMPLO(emplid)
);

-- 休暇データベース
CREATE TABLE TBL_LEAVE (
  lereid NUMERIC(5) NOT NULL,
  leredt DATE NOT NULL,
  leretp NUMERIC(1) NOT NULL, -- 1:年次有給, 2:産前, 3:産後, 4:育児, 5:介護, 6:子の看護, 7:生理, 8:母性健康管理
  PRIMARY KEY (lereid, leredt), -- 社員番号と日付でユニークにする
  FOREIGN KEY (lereid) REFERENCES TBL_EMPLO(emplid)
);

-- 給与データベース
CREATE TABLE TBL_SALRY (
  srlyid NUMERIC(5) NOT NULL,
  srlymt VARCHAR(6) NOT NULL, -- YYYYMM
  srlykh INTEGER NOT NULL, -- 基本給
  srlyzg INTEGER NOT NULL, -- 残業手当
  srlyke INTEGER NOT NULL, -- 健康保険料
  srlyka INTEGER NOT NULL, -- 介護保険料
  srlyko INTEGER NOT NULL, -- 厚生年金
  srlyky INTEGER NOT NULL, -- 雇用保険料
  srlysy INTEGER NOT NULL, -- 所得税
  srlysz INTEGER NOT NULL, -- 住民税
  PRIMARY KEY (srlyid, srlymt), -- 社員番号と支払月でユニークにする
  FOREIGN KEY (srlyid) REFERENCES TBL_EMPLO(emplid)
);

-- 人事考課データベース

CREATE TABLE TBL_KOUKA (
  kokaid NUMERIC(5) NOT NULL,
  kokamt VARCHAR(6) NOT NULL, -- YYYYMM
  kokabk VARCHAR(256),        -- 部下入力項目
  kokazg NUMERIC(1),          -- 能力評価 (1〜5)
  kokake NUMERIC(1),          -- 行動評価 (1〜5)
  kokaty NUMERIC(1),          -- 態度評価 (1〜5)
  kokajs VARCHAR(256),        -- 上司入力項目
  PRIMARY KEY (kokaid, kokamt), -- 複合主キー修正
  FOREIGN KEY (kokaid) REFERENCES TBL_EMPLO(emplid), -- 外部キーテーブル名修正
  CHECK (kokazg IS NULL OR (kokazg >= 1 AND kokazg <= 5)),
  CHECK (kokake IS NULL OR (kokake >= 1 AND kokake <= 5)),
  CHECK (kokaty IS NULL OR (kokaty >= 1 AND kokaty <= 5))
);

##インサート文

INSERT INTO TBL_EMPLO (emplid, emplps, emplnm) VALUES
(10001, 'abc1234', '一般 太郎'),
(10002, 'def1234', '一般 花子'),
(20001, 'ghi1234', '上司 次郎');

INSERT INTO TBL_ATTEN (atteid, attedt, attest, atteet) VALUES
(10001, '2025-04-01', '09:00:00', '18:05:30'),
(10001, '2025-04-02', '09:10:15', '19:00:00'),
(10001, '2025-04-03', '08:55:00', NULL),
(10002, '2025-04-01', '09:30:00', '17:45:10');

INSERT INTO TBL_LEAVE (lereid, leredt, leretp) VALUES
(10001, '2025-04-10', 1),
(10001, '2025-04-11', 1),
(10002, '2025-04-15', 8);

INSERT INTO TBL_SALRY (srlyid, srlymt, srlykh, srlyzg, srlyke, srlyka, srlyko, srlyky, srlysy, srlysz) VALUES
(10001, '202504', 250000, 15000, 12500, 4500, 22875, 1250, 8500, 25000);

INSERT INTO TBL_SALRY (srlyid, srlymt, srlykh, srlyzg, srlyke, srlyka, srlyko, srlyky, srlysy, srlysz) VALUES
(10002, '202504', 230000, 5000, 11500, 4140, 21038, 1150, 6800, 23000);

INSERT INTO TBL_KOUKA (kokaid, kokamt, kokabk, kokazg, kokake, kokaty, kokajs) VALUES
(10001, '202504', '今月は〇〇プロジェクトの設計を担当し、期限内に完了できました。特に△△の部分で新しい技術を導入し効率化を図りました。来月は□□の改善に注力したいです。', NULL, NULL, NULL, NULL);

INSERT INTO TBL_KOUKA (kokaid, kokamt, kokabk, kokazg, kokake, kokaty, kokajs) VALUES
(10002, '202504', '顧客からの問い合わせ対応を迅速に行い、解決率も向上しました。マニュアルの整備にも貢献しました。', 4, 5, 4, '顧客対応が非常に丁寧で評価が高い。チームへの貢献も素晴らしい。来期はリーダーシップを発揮することも期待。');

##画面詳細
1、ログイン画面(login)
employeesテーブルの社員番号EMPLID とパスワードEMPLPS が一致したらメイン画面に遷移する。
1~~~~だと部下、2~~~~だと上司としてログインする。
2、メイン画面(main)
以下三画面に遷移する用のメイン画面。四角で四角の中に画面名とちょっとした詳細が出るようにしたい。
カーソルを合わせたらちょっと大きくなるようにしたい。
3、勤怠画面(kintai)
左側にカレンダー（ライブラリは使わない）。右側には出退勤時間を入力できるようにする。あと休暇。
左側のカレンダーの日付をクリックすると右側も変わるようにしたい。
左側のカレンダーには時刻があれば日付よりも小さく表示する。
どこかそれっぽい場所に休暇の一覧を表示する。
毎月最終日締めで、翌月の第一金曜日まで入力を許可して、それを過ぎると自動で勤怠が締められる。整合性が取れるかのチェックを裏でしておきたい。
締めたら給与テーブルにインサートする。健康保険料: 5%、厚生年金保険料: 9.15%、介護保険料: 約1.8%、雇用保険料: 0.5%
所得税（単純に前年の基本給かける12で考えてほしい。）
累進課税制度により、収入に応じて税率が変動
195万円以下: 5%
195万円超330万円以下: 10%
330万円超695万円以下: 20%
695万円超900万円以下: 23%
900万円超1,800万円以下: 33%
1,800万円超4,000万円以下: 40%
4,000万円超: 45%
住民税10%
4、給与画面(kyuyo)
表示のみ。月を変更することも可能。控除額の合計や手取額の合計はテーブルにないので、ロジック内で計算してください。
5、人事考課画面(kouka)
部下は目標項目のみ入力可能。
上司は3項目（能力、行動、態度）ラジオで5段階評価
前回どうだったかとかも表示してほしい。

##ディレクトリ構造(他に増やさないでほしい）
jinji/
├── jinji_back/
│   ├── Dockerfile
│   ├── go.mod
│   ├── go.sum          # go mod tidy で自動生成される予定
│   ├── kintai.go     
│   ├── kouka.go        
│   ├── kyuyo.go         
│   ├── login.go        
│   ├── main.go         
├── jinji_front/
│   ├── node_modules/     # npx create-react-app jinji_front --template typescript で自動生成される予定
│   ├── public/
│   │   └── index.html   # ブラウザが最初に読むHTML
│   ├── src/
│   │   ├── components/  # UIコンポーネント (画面含む)
│   │   │   ├── Kintai.tsx
│   │   │   ├── Kouka.tsx
│   │   │   ├── Kyuyo.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Main.tsx
│   │   │   └── common.css # 共通スタイル
│   │   ├── AuthContext.tsx # 認証 Context
│   │   ├── useAuth.ts      # 認証 Hook
│   │   ├── api.ts          # API 通信
│   │   ├── types.ts        # 型定義
│   │   ├── App.tsx         # アプリ全体の骨組み・ルーティング
│   │   └── index.tsx       # React 起動
│   ├── .gitignore          # Git 無視リスト
│   ├── Dockerfile          # フロントエンド用 Docker 設定
│   ├── package.json        # プロジェクトと依存関係定義
│   └── tsconfig.json       # TypeScript 設定
│
└── docker-compose.yml      # (プロジェクトルート jinji/ 直下に配置)

##コーディング規約
共通
インデント: 2スペース
ファイル名: ケバブケース (user-service.go, user-profile.tsx)
変数名: キャメルケース (userName)
バックエンド(Go)
パッケージ名: 小文字一語
公開関数: 大文字始まり
非公開関数: 小文字始まり
エラー処理: 必ず行う
Go
if err != nil {
    return err
}
フロントエンド(React + TS)
コンポーネント: パスカルケース (UserProfile)
Props: 型定義必須
CSS: 共通を記載。基本はtsxに記載する。
状態管理: hooks優先
フォーマッター
Go: go fmt
TS: prettier
テーブル名は "TBL_" + 5文字の英字
カラム名は テーブル名の最初の4文字 + 2文字の英字
