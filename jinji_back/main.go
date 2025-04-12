package main

import (
  "database/sql"
  "errors"
  "log"
  "net/http"
  "os"
  "strconv"

  "github.com/gin-gonic/gin"
  _ "github.com/lib/pq" // PostgreSQL ドライバー
  "golang.org/x/crypto/bcrypt"
)

// DB接続用グローバル変数（簡便な実装のため）
var db *sql.DB

// 社員情報構造体（TBL_EMPLOに対応）
type Employee struct {
  EmplID  int    `json:"emplid"`
  EmplPS  string `json:"emplps"` // ハッシュ化済みのパスワード
  EmplNM  string `json:"emplnm"`
}

// ログイン用リクエスト構造体
type LoginRequest struct {
  EmplID int    `json:"emplid"`
  Password string `json:"password"`
}

// ログイン結果構造体（役割振り分けのための例：1〜部下、2〜上司）
type LoginResponse struct {
  EmplID int    `json:"emplid"`
  EmplNM string `json:"emplnm"`
  Role   string `json:"role"`  // 部下: "staff", 上司: "manager"
}

// エラーレスポンスの共通フォーマット
type ErrorResponse struct {
  Message string `json:"message"`
}

// DB接続初期化（環境変数 NEON_CONNECT を利用）
func initDB() error {
  dsn := os.Getenv("NEON_CONNECT")
  if dsn == "" {
    return errors.New("NEON_CONNECT 環境変数が設定されていません")
  }
  var err error
  // PostgreSQLへ接続
  db, err = sql.Open("postgres", dsn)
  if err != nil {
    return err
  }
  // 接続確認
  return db.Ping()
}

// パスワードチェック（bcrypt利用）
func checkPassword(hashedPwd, plainPwd string) bool {
  err := bcrypt.CompareHashAndPassword([]byte(hashedPwd), []byte(plainPwd))
  return err == nil
}

// 社員情報取得（ログイン認証用）
func getEmployeeByID(emplID int) (*Employee, error) {
  query := "SELECT emplid, emplps, emplnm FROM TBL_EMPLO WHERE emplid = $1"
  row := db.QueryRow(query, emplID)
  var emp Employee
  err := row.Scan(&emp.EmplID, &emp.EmplPS, &emp.EmplNM)
  if err != nil {
    return nil, err
  }
  return &emp, nil
}

// POST /login エンドポイント
func handleLogin(c *gin.Context) {
  var req LoginRequest
  if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, ErrorResponse{Message: "リクエストの形式が正しくありません"})
    return
  }

  emp, err := getEmployeeByID(req.EmplID)
  if err != nil {
    c.JSON(http.StatusUnauthorized, ErrorResponse{Message: "ユーザが存在しません"})
    return
  }
  if !checkPassword(emp.EmplPS, req.Password) {
    c.JSON(http.StatusUnauthorized, ErrorResponse{Message: "パスワードが一致しません"})
    return
  }

  // 社員番号先頭数字で役割判定（例として、1~~~~：部下、2~~~~：上司）
  role := "staff"
  emplIDStr := strconv.Itoa(emp.EmplID)
  if len(emplIDStr) > 0 && emplIDStr[0] == '2' {
    role = "manager"
  }

  // 認証成功の場合は、セッションやJWT発行処理をここに追加可能
  // 今回は単純なレスポンスを返す
  c.JSON(http.StatusOK, LoginResponse{
    EmplID: emp.EmplID,
    EmplNM: emp.EmplNM,
    Role:   role,
  })
}

// サンプル: 勤怠データ登録/更新用エンドポイント
type KintaiRequest struct {
  AtteID int    `json:"atteid"` // 社員番号
  Attedt string `json:"attedt"` // 日付 "YYYY-MM-DD"
  Attest string `json:"attest"` // 出勤時刻 "HH:MM:SS"
  Atteet string `json:"atteet"` // 退勤時刻 "HH:MM:SS" または空文字（NULL）
  // 休暇情報等、その他のパラメータも必要に応じ追加
}

func handleKintai(c *gin.Context) {
  var req KintaiRequest
  if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, ErrorResponse{Message: "リクエスト形式エラー"})
    return
  }
  // 勤怠テーブル（TBL_ATTEN）に対する INSERT/UPDATE 処理
  query := `INSERT INTO TBL_ATTEN (atteid, attedt, attest, atteet)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (atteid, attedt) DO UPDATE SET attest = EXCLUDED.attest, atteet = EXCLUDED.atteet`
  _, err := db.Exec(query, req.AtteID, req.Attedt, req.Attest, req.Atteet)
  if err != nil {
    c.JSON(http.StatusInternalServerError, ErrorResponse{Message: "勤怠データの保存に失敗しました"})
    return
  }
  c.JSON(http.StatusOK, gin.H{"message": "勤怠データを保存しました"})
}

// サンプル: 給与確定処理（勤怠締め時に自動実行される想定）  
// 詳細な計算ロジックについては、要件に沿って計算式を実装。ここでは基本例を示す。
func calculateAndInsertSalary(emplID int, targetMonth string) error {
  // 例: 出勤時刻、残業手当等をDBから取得し、給与明細を計算する
  // ※ 本実装例では、固定値を利用していますが、必要に応じて勤怠や休暇データを読み込み計算すること
  var basicSalary, overtime int
  // 以下は実際の計算ロジックに基づきDB集計を実施（例として固定値）
  basicSalary = 250000
  overtime = 15000

  // 各種保険料の計算（例：健康保険:5%, 厚生年金:9.15%, 介護保険:1.8%, 雇用保険:0.5%）
  healthInsurance := int(float64(basicSalary) * 0.05)
  welfarePension := int(float64(basicSalary) * 0.0915)
  nursingCare := int(float64(basicSalary) * 0.018)
  employmentInsurance := int(float64(basicSalary) * 0.005)

  // 所得税の計算例
  // 前年基本給の月割で単純計算として想定（実際は累進課税制度に基づく）
  annualSalary := basicSalary * 12
  taxRate := 0.05
  switch {
  case annualSalary > 4000000:
    taxRate = 0.45
  case annualSalary > 1800000:
    taxRate = 0.40
  case annualSalary > 900000:
    taxRate = 0.33
  case annualSalary > 695000:
    taxRate = 0.23
  case annualSalary > 330000:
    taxRate = 0.20
  case annualSalary > 195000:
    taxRate = 0.10
  }
  incomeTax := int(float64(basicSalary) * (taxRate / 12))

  // 住民税10%
  residentTax := int(float64(basicSalary) * 0.10)

  // 給与テーブルへINSERT
  query := `INSERT INTO TBL_SALRY (srlyid, srlymt, srlykh, srlyzg, srlyke, srlyka, srlyko, srlyky, srlysy, srlysz)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
  _, err := db.Exec(query, emplID, targetMonth, basicSalary, overtime,
    healthInsurance, nursingCare, welfarePension, employmentInsurance, incomeTax, residentTax)
  if err != nil {
    return err
  }
  return nil
}

// サンプル: 人事考課登録処理（部下入力・上司評価）
type KoukaRequest struct {
  KokaID int    `json:"kokaid"` // 社員番号
  Kokamt string `json:"kokamt"` // 評価対象年月 (YYYYMM)
  Kokabk string `json:"kokabk"` // 部下入力項目（任意）
  Kokazg *int   `json:"kokazg"` // 能力評価（上司入力、1〜5）
  Kokake *int   `json:"kokake"` // 行動評価
  Kokaty *int   `json:"kokaty"` // 態度評価
  Kokajs string `json:"kokajs"` // 上司入力項目（任意）
}

func handleKouka(c *gin.Context) {
  var req KoukaRequest
  if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, ErrorResponse{Message: "リクエスト形式エラー"})
    return
  }
  // データ登録
  query := `INSERT INTO TBL_KOUKA (kokaid, kokamt, kokabk, kokazg, kokake, kokaty, kokajs)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (kokaid, kokamt) DO UPDATE 
      SET kokabk = EXCLUDED.kokabk, kokazg = EXCLUDED.kokazg, kokake = EXCLUDED.kokake, kokaty = EXCLUDED.kokaty, kokajs = EXCLUDED.kokajs`
  _, err := db.Exec(query, req.KokaID, req.Kokamt, req.Kokabk, req.Kokazg, req.Kokake, req.Kokaty, req.Kokajs)
  if err != nil {
    c.JSON(http.StatusInternalServerError, ErrorResponse{Message: "考課データの保存に失敗しました"})
    return
  }
  c.JSON(http.StatusOK, gin.H{"message": "考課データを保存しました"})
}

func main() {
  // ログ出力フォーマット設定（必要に応じカスタマイズ）
  log.SetFlags(log.LstdFlags | log.Lshortfile)

  // DB初期化
  if err := initDB(); err != nil {
    log.Fatalf("DB接続失敗: %v", err)
  }
  defer db.Close()

  // Ginルーター作成
  router := gin.Default()

  // 各エンドポイントの登録
  router.POST("/login", handleLogin)
  router.POST("/kintai", handleKintai)
  router.POST("/kouka", handleKouka)

  // 給与計算処理のエンドポイントは実際は定期処理の対象だが、テスト用として用意
  router.POST("/calc-salary/:emplid/:month", func(c *gin.Context) {
    emplid, err := strconv.Atoi(c.Param("emplid"))
    if err != nil {
      c.JSON(http.StatusBadRequest, ErrorResponse{Message: "社員番号の形式が正しくありません"})
      return
    }
    targetMonth := c.Param("month")
    if err := calculateAndInsertSalary(emplid, targetMonth); err != nil {
      c.JSON(http.StatusInternalServerError, ErrorResponse{Message: "給与計算処理に失敗しました"})
      return
    }
    c.JSON(http.StatusOK, gin.H{"message": "給与計算が完了しました"})
  })

  // サーバ起動（ポート番号は必要に応じ設定）
  port := os.Getenv("PORT")
  if port == "" {
    port = "8080"
  }
  log.Printf("サーバ起動: ポート %s", port)
  router.Run(":" + port)
}
