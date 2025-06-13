# 人事システム実装

以下に人事システムの実装を行います。まず、ディレクトリ構造を作成し、バックエンド（Go/Gin）とフロントエンド（React/TypeScript）の実装を進めていきます。

## ディレクトリ構造

設計書に基づき、以下のディレクトリ構造を作成します：

```
jinji/
├── jinji_back/                        # バックエンドアプリケーション
│   ├── Dockerfile
│   ├── go.mod
│   ├── go.sum
│   ├── kintai.go                      # 勤怠管理API
│   ├── kouka.go                       # 人事考課API
│   ├── kyuyo.go                       # 給与管理API
│   ├── login.go                       # 認証API
│   ├── main.go                        # エントリーポイント
├── jinji_front/                       # フロントエンドアプリケーション
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Kintai.tsx             # 勤怠管理画面
│   │   │   ├── Kouka.tsx              # 人事考課画面
│   │   │   ├── Kyuyo.tsx              # 給与管理画面
│   │   │   ├── Login.tsx              # ログイン画面
│   │   │   ├── Main.tsx               # メイン画面
│   │   │   └── common.css             # 共通スタイル
│   │   ├── AuthContext.tsx
│   │   ├── useAuth.ts
│   │   ├── api.ts
│   │   ├── types.ts
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── .gitignore
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
└── docker-compose.yml
```

## バックエンド実装 (Go/Gin)

### 1. main.go

```go
package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

var db *sql.DB

func main() {
	// データベース接続
	var err error
	connStr := os.Getenv("NEON_CONNECT")
	if connStr == "" {
		log.Fatal("環境変数 NEON_CONNECT が設定されていません")
	}

	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("データベース接続エラー: %v", err)
	}
	defer db.Close()

	// 接続確認
	if err := db.Ping(); err != nil {
		log.Fatalf("データベース接続確認エラー: %v", err)
	}

	// 接続プールの設定
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Ginルーターの設定
	router := setupRouter()

	// サーバー起動
	fmt.Println("サーバーを起動しています...")
	if err := router.Run(":8080"); err != nil {
		log.Fatalf("サーバー起動エラー: %v", err)
	}
}

func setupRouter() *gin.Engine {
	router := gin.Default()

	// CORSミドルウェア設定
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// ルーティング設定
	api := router.Group("/api")
	{
		// 認証不要のエンドポイント認証不要のエンドポイント
		api.POST("/login", loginHandler)

		// 認証が必要なエンドポイント
		auth := api.Group("/")
		auth.Use(authMiddleware())
		{
			// 勤怠管理API
			auth.GET("/attendance", getAttendanceHandler)
			auth.POST("/attendance", saveAttendanceHandler)
			auth.POST("/leave", saveLeaveHandler)
			auth.DELETE("/leave", deleteLeaveHandler)
			auth.POST("/attendance/close", closeAttendanceHandler)

			// 給与管理API
			auth.GET("/salary", getSalaryHandler)
			auth.GET("/salary/history", getSalaryHistoryHandler)

			// 人事考課API
			auth.GET("/evaluation", getEvaluationHandler)
			auth.POST("/evaluation/self", saveSelfEvaluationHandler)
			auth.POST("/evaluation/manager", saveManagerEvaluationHandler)
			auth.GET("/evaluation/history", getEvaluationHistoryHandler)
		}
	}

	// ヘルスチェック用エンドポイント
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
		})
	})

	return router
}
```

### 2. login.go

```go
package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	EmployeeID string `json:"employeeId" binding:"required"`
	Password   string `json:"password" binding:"required"`
}

type Claims struct {
	EmployeeID string `json:"employeeId"`
	Role       int    `json:"role"`
	jwt.RegisteredClaims
}

// ログインハンドラー
func loginHandler(c *gin.Context) {
	var request LoginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエストです"})
		return
	}

	// ユーザー情報を取得
	var storedHash string
	var employeeName string
	var role int
	query := `SELECT emplps, emplnm, emplrl FROM TBL_EMPLO WHERE emplid = $1`
	err := db.QueryRow(query, request.EmployeeID).Scan(&storedHash, &employeeName, &role)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "認証に失敗しました"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "サーバーエラーが発生しました"})
		return
	}

	// パスワード検証
	if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(request.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "認証に失敗しました"})
		return
	}

	// JWTトークン生成
	token, err := generateToken(request.EmployeeID, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "トークン生成に失敗しました"})
		return
	}

	// 成功レスポンス
	c.JSON(http.StatusOK, gin.H{
		"token":        token,
		"employeeId":   request.EmployeeID,
		"employeeName": employeeName,
		"role":         role,
	})
}

// JWTトークン生成
func generateToken(employeeID string, role int) (string, error) {
	// JWTシークレットキー取得
	jwtKey := []byte(os.Getenv("JWT_SECRET"))
	if len(jwtKey) == 0 {
		jwtKey = []byte("default_secret_key") // デフォルトキー（本番環境では必ず環境変数で設定すること）
	}

	// 有効期限設定（24時間）
	expirationTime := time.Now().Add(24 * time.Hour)

	// クレーム作成
	claims := &Claims{
		EmployeeID: employeeID,
		Role:       role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	// トークン生成
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtKey)
}

// 認証ミドルウェア
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// JWTシークレットキー取得
		jwtKey := []byte(os.Getenv("JWT_SECRET"))
		if len(jwtKey) == 0 {
			jwtKey = []byte("default_secret_key") // デフォルトキー
		}

		// Authorization ヘッダーからトークン取得
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "認証トークンがありません"})
			c.Abort()
			return
		}

		// Bearer スキーム確認
		tokenString := ""
		fmt.Sscanf(authHeader, "Bearer %s", &tokenString)
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "無効なトークン形式です"})
			c.Abort()
			return
		}

		// トークン検証
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "無効なトークンです"})
			c.Abort()
			return
		}

		// クレームをコンテキストに保存
		c.Set("employeeId", claims.EmployeeID)
		c.Set("role", claims.Role)

		c.Next()
	}
}

// ロールベース認可ミドルウェア
func requireRole(requiredRole int) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "認証情) {
		role, exists報がありません"})
			c.Abort()
			return
		}

		userRole := role.(int)
		if userRole < requiredRole {
			c.JSON(http.StatusForbidden, gin.H{"error": "この操作を行う権限がありません"})
			c.Abort()
			return
		}

		c.Next()
	}
}
```

### 3. kintai.go

```go
package main

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// 勤怠データ構造体
type AttendanceData struct {
	EmployeeID string `json:"employeeId"`
	Date       string `json:"date"`
	StartTime  string `json:"startTime,omitempty"`
	EndTime    string `json:"endTime,omitempty"`
}

// 休暇データ構造体
type LeaveData struct {
	EmployeeID   string `json:"employeeId"`
	Date         string `json:"date"`
	LeaveType    int    `json:"leaveType"`
	LeaveTypeName string `json:"leaveTypeName,omitempty"`
}

// 勤怠情報取得ハンドラー
func getAttendanceHandler(c *gin.Context) {
	// パラメータ取得
	yearStr := c.Query("year")
	monthStr := c.Query("month")
	targetEmployeeID := c.Query("employeeId")
	currentEmployeeID := c.GetString("employeeId")
	role := c.GetInt("role")

	// 年月パラメータのバリデーション
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効な年パラメータです"})
		return
	}
	month, err := strconv.Atoi(monthStr)
	if err != nil || month < 1 || month > 12 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効な月パラメータです"})
		return
	}

	// 権限チェック
	if targetEmployeeID == "" {
		targetEmployeeID = currentEmployeeID
	EmployeeID = currentEmployeeID
	} else if targetEmployeeID != currentEmployeeID && role < 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "指定された社員の勤怠情報へのアクセス権限がありません"})
		return
	}

	// 月の開始日と終了日を計算
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, 0).Add(-time.Second)

	// 勤怠データ取得
	attendanceData, err := getAttendanceData(targetEmployeeID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "勤怠データの取得に失敗しました"})
		return
	}

	// 休暇データ取得
	leaveData, err := getLeaveData(targetEmployeeID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "休暇データの取得に失敗しました"})
		return
	}

	// レスポンス返却
	c.JSON(http.StatusOK, gin.H{
		"attendanceData": attendanceData,
		"leaveData":      leaveData,
	})
}

// 勤怠データをデータベースから取得
func getAttendanceData(employeeID string, startDate, endDate time.Time) ([]AttendanceData, error) {
	query := `
		SELECT atteid, attedt, attest, atteet 
		FROM TBL_ATTEN 
		WHERE atteid = $1 AND attedt BETWEEN $2 AND $3
		ORDER BY attedt
	`
	rows, err := db.Query(query, employeeID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []AttendanceData
	for rows.Next() {
		var data AttendanceData
		var startTime, endTime sql.NullString
		err := rows.Scan(&data.EmployeeID, &data.Date, &startTime, &endTime)
		if err != nil {
			return nil, err
		}
		if startTime.Valid {
			data.StartTime = startTime.String
		}
		if endTime.Valid {
			data.EndTime = endTime.String
		}
		result = append(result, data)
	}

	return result, nil
}

// 休暇データをデータベースから取得
func getLeaveData(employeeID string, startDate, endDate time.Time) ([]LeaveData, error) {
	query := `
		SELECT lereid, leredt, leretp 
		FROM TBL_LEAVE 
		WHERE lereid = $1 AND leredt BETWEEN $2 AND $3
		ORDER BY leredt
	`
	rows, err := db.Query(query, employeeID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []LeaveData
	for rows.Next() {
		var data LeaveData
		err := rows.Scan(&data.EmployeeID, &data.Date, &data.LeaveType)
		if err != nil {
			return nil, err
		}
		data.LeaveTypeName = getLeaveTypeName(data.LeaveType)
		result = append(result, data)
	}

	return result, nil
}

// 休暇種別名取得
func getLeaveTypeName(leaveType int) string {
	leaveTypes := map[int]string{
		1: "年次有給",
		2: "産前",
		3: "産後",
		4: "育児",
		5: "介護",
		6: "子の看護",
		7: "生理",
		8: "母性健康管理",
	}
	return leaveTypes[leaveType]
}

// 勤怠情報保存ハンドラー
func saveAttendanceHandler(c *gin.Context) {
	var request AttendanceData
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエストです"})
		return
	}

	// 権限チェック
	currentEmployeeID := c.GetString("employeeId")
	role := c.GetInt("role")
	
	if request.EmployeeID == "" {
		request.EmployeeID = currentEmployeeID
	} else if request.EmployeeID != currentEmployeeID && role < 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "指定された社員の勤怠情報を変更する権限がありません"})
		return
	}

	// 締め日チェック
	if !canEditAttendance(request.EmployeeID, request.Date) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "締め切り後の勤怠情報は編集できません"})
		return
	}

	// 時間のバリデーション
	if request.StartTime != "" && request.EndTime != "" {
		if request.StartTime >= request.EndTime {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "勤怠情報の保存に失敗しました",
				"details": "終了時刻は開始時刻より後である必要があります",
			})
			return
		}
	}

	// 休暇情報の存在チェック
	exists, err := checkLeaveExists(request.EmployeeID, request.Date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "休暇情報の確認に失敗しました"})
		return
	}
	if exists {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "勤怠情報の保存に失敗しました",
			"details": "指定された日付には既に休暇が登録されています",
		})
		return
	}

	// トランザクション開始
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "トランザクション開始に失敗しました"})
		return
	}
	defer tx.Rollback()

	// 既存データの確認
	var exists2 bool
	err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM TBL_ATTEN WHERE atteid = $1 AND attedt = $2)", request.EmployeeID, request.Date).Scan(&exists2)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "勤怠情報の確認に失敗しました"})
		return
	}

	var query string
	var args []interface{}

	if exists2 {
		// 更新
		query = "UPDATE TBL_ATTEN SET attest = $1, atteet = $2 WHERE atteid = $3 AND attedt = $4"
		args = []interface{}{request.StartTime, request.EndTime, request.EmployeeID, request.Date}
	} else {
		// 新規登録
		query = "INSERT INTO TBL_ATTEN (atteid, attedt, attest, atteet) VALUES ($1, $2, $3, $4)"
		args = []interface{}{request.EmployeeID, request.Date, request.StartTime, request.EndTime}
	}

	_, err = tx.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "勤怠情報の保存に失敗しました"})
		return
	}

	// トランザクションコミット
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "トランザクションのコミットに失敗しました"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "勤怠情報を保存しました",
	})
}

// 休暇情報保存ハンドラー
func saveLeaveHandler(c *gin.Context) {
	var request LeaveData
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエストです"})
		return
	}

	// 権限チェック
	currentEmployeeID := c.GetString("employeeId")
	role := c.GetInt("role")
	
	if request.EmployeeID == "" {
		request.EmployeeID = currentEmployeeID
	} else if request.EmployeeID != currentEmployeeID && role < 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "指定された社員の休暇情報を変更する権限がありません"})
		return
	}

	// 休暇種別のバリデーション
	if request.LeaveType < 1 || request.LeaveType > 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効な休暇種別です"})
		return
	}

	// 締め日チェック
	if !canEditAttendance(request.EmployeeID, request.Date) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "締め切り後の休暇情報は編集できません"})
		return
	}

	// 勤怠情報の存在チェック
	exists, err := checkAttendanceExists(request.EmployeeID, request.Date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "勤怠情報の確認に失敗しました"})
		return
	}
	if exists {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "休暇情報の登録に失敗しました",
			"details": "指定された日付には既に勤怠情報が登録されています",
		})
		return
	}

	// トランザクション開始
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "トランザクション開始に失敗しました"})
		return
	}
	defer tx.Rollback()

	// 既存データの確認
	var exists2 bool
	err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM TBL_LEAVE WHERE lereid = $1 AND leredt = $2)", request.EmployeeID, request.Date).Scan(&exists2)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "休暇情報の確認に失敗しました"})
		return
	}

	var query string
	var args []interface{}

	if exists2 {
		// 更新
		query = "UPDATE TBL_LEAVE SET leretp = $1 WHERE lereid = $2 AND leredt = $3"
		args = []interface{}{request.LeaveType, request.EmployeeID, request.Date}
	} else {
		// 新規登録
		query = "INSERT INTO TBL_LEAVE (lereid, leredt, leretp) VALUES ($1, $2, $3)"
		args = []interface{}{request.EmployeeID, request.Date, request.LeaveType}
	}

	_, err = tx.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "休暇情報の保存に失敗しました"})
		return
	}

	// トランザクションコミット
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "トランザクションのコミットに失敗しました"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "休暇情報を登録しました",
	})
}

// 休暇情報削除ハンドラー
func deleteLeaveHandler(c *gin.Context) {
	employeeID := c.Query("employeeId")
	date := c.Query("date")

	// パラメータのバリデーション
	if employeeID == "" || date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "社員IDと日付は必須です"})
		return
	}

	// 権限チェック
	currentEmployeeID := c.GetString("employeeId")
	role := c.GetInt("role")
	
	if employeeID != currentEmployeeID && role < 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "指定された社員の休暇情報を削除する権限がありません"})
		return
	}

	// 締め日チェック
	if !canEditAttendance(employeeID, date) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "締め切り後の休暇情報は編集できません"})
		return
	}

	// 休暇情報の削除
	result, err := db.Exec("DELETE FROM TBL_LEAVE WHERE lereid = $1 AND leredt = $2", employeeID, date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "休暇情報の削除に失敗しました"})
		return
	}

	// 影響を受けた行数の確認
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "影響を受けた行数の取得に失敗しました"})
		return
	}

	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "指定された休暇情報が見つかりません"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "休暇情報を削除しました",
	})
}

// 勤怠締めハンドラー
func closeAttendanceHandler(c *gin.Context) {
	// 権限チェック（人事のみ実行可能）
	role := c.GetInt("role")
	if role < 3 {
		c.JSON(http.StatusForbidden, gin.H{"error": "勤怠締め処理を実行する権限がありません"})
		return
	}

	var request struct {
		YearMonth string `json:"yearMonth" binding:"required"` // YYYYMM形式
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエストです"})
		return
	}

	// 年月のバリデーション
	if len(request.YearMonth) != 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "年月はYYYYMM形式で指定してください"})
		return
	}

	// トランザクション開始
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "トランザクション開始に失敗しました"})
		return
	}
	defer tx.Rollback()

	// 全社員の勤怠データを処理
	var employeeIDs []string
	rows, err := tx.Query("SELECT emplid FROM TBL_EMPLO")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "社員データの取得に失敗しました"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "社員IDの取得に失敗しました"})
			return
		}
		employeeIDs = append(employeeIDs, id)
	}

	// 各社員の勤怠を処理
	for _, id := range employeeIDs {
		// 勤怠データの整合性チェック
		if err := checkAttendanceConsistency(tx, id, request.YearMonth); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "勤怠データの整合性チェックに失敗しました",
				"details": err.Error(),
			})
			return
		}

		// 給与計算と登録
		if err := calculateAndRegisterSalary(tx, id, request.YearMonth); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "給与計算・登録に失敗しました",
				"details": err.Error(),
			})
			return
		}
	}

	// トランザクションコミット
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "トランザクションのコミットに失敗しました"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "勤怠締め処理が完了しました",
	})
}

// 勤怠データの整合性チェック
func checkAttendanceConsistency(tx *sql.Tx, employeeID string, yearMonth string) error {
	// 年月から月の開始日と終了日を計算
	year, _ := strconv.Atoi(yearMonth[:4])
	month, _ := strconv.Atoi(yearMonth[4:])
	
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, 0).Add(-time.Second)

	// 同一日に勤怠と休暇が両方登録されていないかチェック
	query := `
		SELECT a.attedt 
		FROM TBL_ATTEN a
		JOIN TBL_LEAVE l ON a.atteid = l.lereid AND a.attedt = l.leredt
		WHERE a.atteid = $1 AND a.attedt BETWEEN $2 AND $3
	`
	rows, err := tx.Query(query, employeeID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))
	if err != nil {
		return err
	}
	defer rows.Close()

	if rows.Next() {
		var date string
		rows.Scan(&date)
		return fmt.Errorf("社員ID %s の %s に勤怠と休暇が両方登録されています", employeeID, date)
	}

	return nil
}

// 給与計算と登録
func calculateAndRegisterSalary(tx *sql.Tx, employeeID string, yearMonth string) error {
	// 年月から月の開始日と終了日を計算
	year, _ := strconv.Atoi(yearMonth[:4])
	month, _ := strconv.Atoi(yearMonth[4:])
	
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, 0).Add(-time.Second)

	// 基本給を取得（仮の実装：実際のシステムでは社員テーブルなどから取得）
	var basicSalary int = 250000 // 固定値として設定

	// 残業時間の計算
	query := `
		SELECT SUM(
			EXTRACT(EPOCH FROM (atteet::time - '17:30:00'::time))/3600
		) 
		FROM TBL_ATTEN 
		WHERE atteid = $1 
		AND attedt BETWEEN $2 AND $3
		AND atteet > '17:30:00'
	`
	var overtimeHours sql.NullFloat64
	err := tx.QueryRow(query, employeeID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).Scan(&overtimeHours)
	if err != nil {
		return err
	}

	// 残業代計算
	var overtimePay int = 0
	if overtimeHours.Valid && overtimeHours.Float64 > 0 {
		// 時給計算（基本給 ÷ 160時間 × 1.25）
		hourlyRate := float64(basicSalary) / 160.0 * 1.25
		overtimePay = int(overtimeHours.Float64 * hourlyRate)
	}

	// 控除額計算
	healthInsurance := int(float64(basicSalary) * 0.05)
	nursingInsurance := int(float64(basicSalary) * 0.018)
	pension := int(float64(basicSalary) * 0.0915)
	employmentInsurance := int(float64(basicSalary) * 0.005)
	
	// 所得税計算（年収に基づく）
	annualIncome := basicSalary * 12
	var incomeTaxRate float64 = 0.05 // デフォルト
	
	if annualIncome > 1950000 && annualIncome <= 3300000 {
		incomeTaxRate = 0.10
	} else if annualIncome > 3300000 && annualIncome <= 6950000 {
		incomeTaxRate = 0.20
	} else if annualIncome > 6950000 && annualIncome <= 9000000 {
		incomeTaxRate = 0.23
	} else if annualIncome > 9000000 && annualIncome <= 18000000 {
		incomeTaxRate = 0.33
	} else if annualIncome > 18000000 && annualIncome <= 40000000 {
		incomeTaxRate = 0.40
	} else if annualIncome > 40000000 {
		incomeTaxRate = 0.45
	}
	
	incomeTax := int(float64(basicSalary + overtimePay) * incomeTaxRate)
	
	// 住民税
	residentTax := int(float64(basicSalary) * 0.1)

	// 給与データをデータベースに保存
	_, err = tx.Exec(`
		INSERT INTO TBL_SALRY (
			srlyid, srlymt, srlykh, srlyzg, srlyke, srlyka, srlyko, srlyky, srlysy, srlysz
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (srlyid, srlymt) DO UPDATE SET
			srlykh = EXCLUDED.srlykh,
			srlyzg = EXCLUDED.srlyzg,
			srlyke = EXCLUDED.srlyke,
			srlyka = EXCLUDED.srlyka,
			srlyko = EXCLUDED.srlyko,
			srlyky = EXCLUDED.srlyky,
			srlysy = EXCLUDED.srlysy,
			srlysz = EXCLUDED.srlysz
	`, employeeID, yearMonth, basicSalary, overtimePay, healthInsurance, nursingInsurance, pension, employmentInsurance, incomeTax, residentTax)

	return err
}

// 勤怠編集可能かチェック
func canEditAttendance(employeeID string, dateStr string) bool {
	// 日付をパース
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return false
	}

	// 月末日を計算
	year, month, _ := date.Date()
	lastDay := time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC)
	
	// 締め日（翌月第一金曜日）を計算
	nextMonth := time.Date(year, month+1, 1, 0, 0, 0, 0, time.UTC)
	daysUntilFriday := (5 - int(nextMonth.Weekday()) + 7) % 7
	if daysUntilFriday == 0 {
		daysUntilFriday = 7
	}
	closingDate := nextMonth.AddDate(0, 0, daysUntilFriday-1)
	
	// 現在日時が締め日を過ぎていなければ編集可能
	return time.Now().Before(closingDate.Add(24 * time.Hour))
}

// 勤怠情報の存在チェック
func checkAttendanceExists(employeeID string, date string) (bool, error) {
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM TBL_ATTEN WHERE atteid = $1 AND attedt = $2)", employeeID, date).Scan(&exists)
	return exists, err
}

// 休暇情報の存在チェック
func checkLeaveExists(employeeID string, date string) (bool, error) {
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM TBL_LEAVE WHERE lereid = $1 AND leredt = $2)", employeeID, date).Scan(&exists)
	return exists, err
}
```

### 4. kyuyo.go

```go
package main

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// 給与データ構造体
type SalaryData struct {
	EmployeeID         string `json:"employeeId"`
	EmployeeName       string `json:"employeeName,omitempty"`
	YearMonth          string `json:"yearMonth"`
	BasicSalary        int    `json:"basicSalary"`
	OvertimePay        int    `json:"overtimePay"`
	TotalIncome        int    `json:"totalIncome,omitempty"`
	HealthInsurance    int    `json:"healthInsurance"`
	NursingInsurance   int    `json:"nursingInsurance"`
	Pension            int    `json:"pension"`
	EmploymentInsurance int   `json:"employmentInsurance"`
	IncomeTax          int    `json:"incomeTax"`
	ResidentTax        int    `json:"residentTax"`
	TotalDeduction     int    `json:"totalDeduction,omitempty"`
	NetAmount          int    `json:"netAmount,omitempty"`
}

// 給与履歴データ構造体
type SalaryHistoryItem struct {
	YearMonth      string `json:"yearMonth"`
	TotalIncome    int    `json:"totalIncome"`
	TotalDeduction int    `json:"totalDeduction"`
	NetAmount      int    `json:"netAmount"`
}

// 給与情報取得ハンドラー
func getSalaryHandler(c *gin.Context) {
	// パラメータ取得
	yearMonth := c.Query("yearMonth")
	targetEmployeeID := c.Query("employeeId")
	currentEmployeeID := c.GetString("employeeId")
	role := c.GetInt("role")

	// 年月パラメータのバリデーション
	if len(yearMonth) != 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "年月はYYYYMM形式で指定してください"})
		return
	}

	// 権限チェック
	if targetEmployeeID == "" {
		targetEmployeeID = currentEmployeeID
	} else if targetEmployeeID != currentEmployeeID && role < 3 {
		c.JSON(http.StatusForbidden, gin.H{"error": "指定された社員の給与情報へのアクセス権限がありません"})
		return
	}

	// 給与データ取得
	query := `
		SELECT e.emplnm, s.srlymt, s.srlykh, s.srlyzg, s.srlyke, s.srlyka, s.srlyko, s.srlyky, s.srlysy, s.srlysz
		FROM TBL_SALRY s
		JOIN TBL_EMPLO e ON s.srlyid = e.emplid
		WHERE s.srlyid = $1 AND s.srlymt = $2
	`
	var salary SalaryData
	err := db.QueryRow(query, targetEmployeeID, yearMonth).Scan(
		&salary.EmployeeName,
		&salary.YearMonth,
		&salary.BasicSalary,
		&salary.OvertimePay,
		&salary.HealthInsurance,
		&salary.NursingInsurance,
		&salary.Pension,
		&salary.EmploymentInsurance,
		&salary.IncomeTax,
		&salary.ResidentTax,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "指定された年月の給与情報が見つかりません"})
		return
	}

	// 計算項目の設定
	salary.EmployeeID = targetEmployeeID
	salary.TotalIncome = salary.BasicSalary + salary.OvertimePay
	salary.TotalDeduction = salary.HealthInsurance + salary.NursingInsurance + salary.Pension + salary.EmploymentInsurance + salary.IncomeTax + salary.ResidentTax
	salary.NetAmount = salary.TotalIncome - salary.TotalDeduction

	c.JSON(http.StatusOK, salary)
}

// 給与履歴取得ハンドラー
func getSalaryHistoryHandler(c *gin.Context) {
	// パラメータ取得
	targetEmployeeID := c.Query("employeeId")
	monthsStr := c.DefaultQuery("months", "6")
	currentEmployeeID := c.GetString("employeeId")
	role := c.GetInt("role")

	// 月数パラメータのバリデーション
	months, err := strconv.Atoi(monthsStr)
	if err != nil || months < 1 || months > 36 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効な月数パラメータです（1〜36の範囲で指定してください）"})
		return
	}

	// 権限チェック
	if targetEmployeeID == "" {
		targetEmployeeID = currentEmployeeID
	} else if targetEmployeeID != currentEmployeeID && role < 3 {
		c.JSON(http.StatusForbidden, gin.H{"error": "指定された社員の給与履歴へのアクセス権限がありません"})
		return
	}

	// 社員名取得
	var employeeName string
	err = db.QueryRow("SELECT emplnm FROM TBL_EMPLO WHERE emplid = $1", targetEmployeeID).Scan(&employeeName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "指定された社員が見つかりません"})
		return
	}

	// 給与履歴データ取得
	query := `
		SELECT srlymt, srlykh, srlyzg, srlyke, srlyka, srlyko, srlyky, srlysy, srlysz
		FROM TBL_SALRY
		WHERE srlyid = $1
		ORDER BY srlymt DESC
		LIMIT $2
	`
	rows, err := db.Query(query, targetEmployeeID, months)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "給与履歴の取得に失敗しました"})
		return
	}
	defer rows.Close()

	var historyItems []SalaryHistoryItem
	for rows.Next() {
		var yearMonth string
		var basicSalary, overtimePay, healthInsurance, nursingInsurance, pension, employmentInsurance, incomeTax, residentTax int
		
		err := rows.Scan(
			&yearMonth,
			&basicSalary,
			&overtimePay,
			&healthInsurance,
			&nursingInsurance,
			&pension,
			&employmentInsurance,
			&incomeTax,
			&residentTax,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "給与データの取得に失敗しました"})
			return
		}

		totalIncome := basicSalary + overtimePay
		totalDeduction := healthInsurance + nursingInsurance + pension + employmentInsurance + incomeTax + residentTax
		netAmount := totalIncome - totalDeduction

		historyItems = append(historyItems, SalaryHistoryItem{
			YearMonth:      yearMonth,
			TotalIncome:    totalIncome,
			TotalDeduction: totalDeduction,
			NetAmount:      netAmount,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"employeeId":     targetEmployeeID,
		"employeeName":   employeeName,
		"salaryHistory":  historyItems,
	})
}
```

### 5. kouka.go

```go
package main

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// 人事考課データ構造体
type EvaluationData struct {
	EmployeeID     string `json:"employeeId"`
	EmployeeName   string `json:"employeeName,omitempty"`
	ManagerID      string `json:"managerId"`
	ManagerName    string `json:"managerName,omitempty"`
	YearMonth      string `json:"yearMonth"`
	SelfEvaluation string `json:"selfEvaluation"`
	AbilityScore   int    `json:"abilityScore,omitempty"`
	BehaviorScore  int    `json:"behaviorScore,omitempty"`
	AttitudeScore  int    `json:"attitudeScore,omitempty"`
	TotalScore     int    `json:"totalScore,omitempty"`
	ManagerComment string `json:"managerComment,omitempty"`
}

// 人事考課履歴項目構造体
type EvaluationHistoryItem struct {
	YearMonth     string `json:"yearMonth"`
	AbilityScore  int    `json:"abilityScore"`
	BehaviorScore int    `json:"behaviorScore"`
	AttitudeScore int    `json:"attitudeScore"`
	TotalScore    int    `json:"totalScore"`
}

// 人事考課情報取得ハンドラー
func getEvaluationHandler(c *gin.Context) {
	// パラメータ取得
	yearMonth := c.Query("yearMonth")
	targetEmployeeID := c.Query("employeeId")
	currentEmployeeID := c.GetString("employeeId")
	role := c.GetInt("role")

	// 年月パラメータのバリデーション
	if len(yearMonth) != 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "年月はYYYYMM形式で指定してください"})
		return
	}

	// 権限チェック
	if targetEmployeeID == "" {
		targetEmployeeID = currentEmployeeID
	} else if targetEmployeeID != currentEmployeeID && role < 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "指定された社員の人事考課情報へのアクセス権限がありません"})
		return
	}

	// 人事考課データ取得
	query := `
		SELECT e1.emplnm, k.kokaji, e2.emplnm, k.kokamt, k.kokabk, k.kokazg, k.kokake, k.kokaty, k.kokajs
		FROM TBL_KOUKA k
		JOIN TBL_EMPLO e1 ON k.kokaid = e1.emplid
		JOIN TBL_EMPLO e2 ON k.kokaji = e2.emplid
		WHERE k.kokaid = $1 AND k.kokamt = $2
	`
	var evaluation EvaluationData
	var abilityScore, behaviorScore, attitudeScore sql.NullInt64
	
	err := db.QueryRow(query, targetEmployeeID, yearMonth).Scan(
		&evaluation.EmployeeName,
		&evaluation.ManagerID,
		&evaluation.ManagerName,
		&evaluation.YearMonth,
		&evaluation.SelfEvaluation,
		&abilityScore,
		&behaviorScore,
		&attitudeScore,
		&evaluation.ManagerComment,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			// 評価データがない場合は、新規作成のために必要な情報だけ返す
			var empName, managerID, managerName string
			
			// 社員名を取得
			err = db.QueryRow("SELECT emplnm FROM TBL_EMPLO WHERE emplid = $1", targetEmployeeID).Scan(&empName)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "指定された社員が見つかりません"})
				return
			}
			
			// 上司情報を取得（仮の実装：実際のシステムでは組織階層テーブルなどから取得）
			// ここでは、社員ロールが2以上の別の社員を上司とする
			err = db.QueryRow("SELECT emplid, emplnm FROM TBL_EMPLO WHERE emplrl >= 2 AND emplid != $1 LIMIT 1", targetEmployeeID).Scan(&managerID, &managerName)
			if err != nil {
				managerID = ""
				managerName = "未設定"
			}
			
			c.JSON(http.StatusOK, gin.H{
				"employeeId":   targetEmployeeID,
				"employeeName": empName,
				"managerId":    managerID,
				"managerName":  managerName,
				"yearMonth":    yearMonth,
			})
			return
		}
		
		c.JSON(http.StatusInternalServerError, gin.H{"error": "人事考課情報の取得に失敗しました"})
		return
	}

	// 計算項目の設定
	evaluation.EmployeeID = targetEmployeeID
	
	if abilityScore.Valid {
		evaluation.AbilityScore = int(abilityScore.Int64)
	}
	if behaviorScore.Valid {
		evaluation.BehaviorScore = int(behaviorScore.Int64)
	}
	if attitudeScore.Valid {
		evaluation.AttitudeScore = int(attitudeScore.Int64)
	}
	
	evaluation.TotalScore = evaluation.AbilityScore + evaluation.BehaviorScore + evaluation.AttitudeScore

	c.JSON(http.StatusOK, evaluation)
}

// 自己評価登録ハンドラー
func saveSelfEvaluationHandler(c *gin.Context) {
	var request struct {
		EmployeeID      string `json:"employeeId"`
		YearMonth       string `json:"yearMonth" binding:"required"`
		SelfEvaluation  string `json:"selfEvaluation" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエストです"})
		return
	}

	// 権限チェック
	currentEmployeeID := c.GetString("employeeId")
	
	if request.EmployeeID == "" {
		request.EmployeeID = currentEmployeeID
	} else if request.EmployeeID != currentEmployeeID {
		c.JSON(http.StatusForbidden, gin.H{"error": "他の社員の自己評価を入力する権限がありません"})
		return
	}

	// 入力値のバリデーション
	if len(request.SelfEvaluation) > 256 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "自己評価の保存に失敗しました",
			"details": "入力文字数が上限を超えています（最大256文字）",
		})
		return
	}

	// トランザクション開始
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "トランザクション開始に失敗しました"})
		return
	}
	defer tx.Rollback()

	// 上司IDを取得（仮の実装：実際のシステムでは組織階層テーブルなどから取得）
	var managerID string
	err = tx.QueryRow("SELECT emplid FROM TBL_EMPLO WHERE emplrl >= 2 AND emplid != $1 LIMIT 1", request.EmployeeID).Scan(&managerID)
	if err != nil {
		managerID = "" // 上司が見つからない場合は空文字とする
	}

	// 既存データの確認
	var exists bool
	err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM TBL_KOUKA WHERE kokaid = $1 AND kokamt = $2)", request.EmployeeID, request.YearMonth).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "人事考課情報の確認に失敗しました"})
		return
	}

	var query string
	var args []interface{}

	if exists {
		// 更新
		query = "UPDATE TBL_KOUKA SET kokabk = $1 WHERE kokaid = $2 AND kokamt = $3"
		args = []interface{}{request.SelfEvaluation, request.EmployeeID, request.YearMonth}
	} else {
		// 新規登録
		query = "INSERT INTO TBL_KOUKA (kokaid, kokaji, kokamt, kokabk) VALUES ($1, $2, $3, $4)"
		args = []interface{}{request.EmployeeID, managerID, request.YearMonth, request.SelfEvaluation}
	}

	_, err = tx.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "自己評価の保存に失敗しました"})
		return
	}

	// トランザクションコミット
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "トランザクションのコミットに失敗しました"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "自己評価を保存しました",
	})
}

// 上司評価登録ハンドラー
func saveManagerEvaluationHandler(c *gin.Context) {
	var request struct {
		EmployeeID      string `json:"employeeId" binding:"required"`
		ManagerID       string `json:"managerId"`
		YearMonth       string `json:"yearMonth" binding:"required"`
		AbilityScore    int    `json:"abilityScore" binding:"min=1,max=5"`
		BehaviorScore   int    `json:"behaviorScore" binding:"min=1,max=5"`
		AttitudeScore   int    `json:"attitudeScore" binding:"min=1,max=5"`
		ManagerComment  string `json:"managerComment"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエストです（スコアは1〜5の範囲で指定してください）"})
		return
	}

	// 権限チェック（上司以上のロールが必要）
	currentEmployeeID := c.GetString("employeeId")
	role := c.GetInt("role")
	
	if role < 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "評価を入力する権限がありません"})
		return
	}

	if request.ManagerID == "" {
		request.ManagerID = currentEmployeeID
	}

	// 評価する権限があるか確認
	if request.ManagerID != currentEmployeeID && role < 3 {
		c.JSON(http.StatusForbidden, gin.H{"error": "指定された社員を評価する権限がありません"})
		return
	}

	// 自分自身を評価していないか確認
	if request.EmployeeID == currentEmployeeID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "自分自身を評価することはできません"})
		return
	}

	// 入力値のバリデーション
	if len(request.ManagerComment) > 256 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "評価の保存に失敗しました",
			"details": "入力文字数が上限を超えています（最大256文字）",
		})
		return
	}

	// 人事考課データの存在確認
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM TBL_KOUKA WHERE kokaid = $1 AND kokamt = $2)", request.EmployeeID, request.YearMonth).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "人事考課情報の確認に失敗しました"})
		return
	}

	// トランザクション開始
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "トランザクション開始に失敗しました"})
		return
	}
	defer tx.Rollback()

	var query string
	var args []interface{}

	if exists {
		// 更新
		query = `
			UPDATE TBL_KOUKA 
			SET kokaji = $1, kokazg = $2, kokake = $3, kokaty = $4, kokajs = $5 
			WHERE kokaid = $6 AND kokamt = $7
		`
		args = []interface{}{
			request.ManagerID,
			request.AbilityScore,
			request.BehaviorScore,
			request.AttitudeScore,
			request.ManagerComment,
			request.EmployeeID,
			request.YearMonth,
		}
	} else {
		// 新規登録
		query = `
			INSERT INTO TBL_KOUKA (kokaid, kokaji, kokamt, kokazg, kokake, kokaty, kokajs) 
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`
		args = []interface{}{
			request.EmployeeID,
			request.ManagerID,
			request.YearMonth,
			request.AbilityScore,
			request.BehaviorScore,
			request.AttitudeScore,
			request.ManagerComment,
		}
	}

	_, err = tx.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "評価の保存に失敗しました"})
		return
	}

	// トランザクションコミット
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "トランザクションのコミットに失敗しました"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "評価を保存しました",
	})
}

// 人事考課履歴取得ハンドラー
func getEvaluationHistoryHandler(c *gin.Context) {
	// パラメータ取得
	targetEmployeeID := c.Query("employeeId")
	countStr := c.DefaultQuery("count", "6")
	currentEmployeeID := c.GetString("employeeId")
	role := c.GetInt("role")

	// 件数パラメータのバリデーション
	count, err := strconv.Atoi(countStr)
	if err != nil || count < 1 || count > 36 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無効な履歴件数パラメータです（1〜36の範囲で指定してください）"})
		return
	}

	// 権限チェック
	if targetEmployeeID == "" {
		targetEmployeeID = currentEmployeeID
	} else if targetEmployeeID != currentEmployeeID && role < 2 {
		c.JSON(http.StatusForbidden, gin.H{"error": "指定された社員の人事考課履歴へのアクセス権限がありません"})
		return
	}

	// 社員名取得
	var employeeName string
	err = db.QueryRow("SELECT emplnm FROM TBL_EMPLO WHERE emplid = $1", targetEmployeeID).Scan(&employeeName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "指定された社員が見つかりません"})
		return
	}

	// 人事考課履歴データ取得
	query := `
		SELECT kokamt, kokazg, kokake, kokaty
		FROM TBL_KOUKA
		WHERE kokaid = $1 AND kokazg IS NOT NULL AND kokake IS NOT NULL AND kokaty IS NOT NULL
		ORDER BY kokamt DESC
		LIMIT $2
	`
	rows, err := db.Query(query, targetEmployeeID, count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "人事考課履歴の取得に失敗しました"})
		return
	}
	defer rows.Close()

	var historyItems []EvaluationHistoryItem
	for rows.Next() {
		var yearMonth string
		var abilityScore, behaviorScore, attitudeScore int
		
		err := rows.Scan(
			&yearMonth,
			&abilityScore,
			&behaviorScore,
			&attitudeScore,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "人事考課データの取得に失敗しました"})
			return
		}

		totalScore := abilityScore + behaviorScore + attitudeScore

		historyItems = append(historyItems, EvaluationHistoryItem{
			YearMonth:     yearMonth,
			AbilityScore:  abilityScore,
			BehaviorScore: behaviorScore,
			AttitudeScore: attitudeScore,
			TotalScore:    totalScore,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"employeeId":         targetEmployeeID,
		"employeeName":       employeeName,
		"evaluationHistory":  historyItems,
	})
}
```

### 6. Dockerfile (バックエンド)

```dockerfile
FROM golang:1.18 as builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o jinji_back .

FROM alpine:latest

RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/jinji_back .

EXPOSE 8080

CMD ["./jinji_back"]
```

## フロントエンド実装 (React/TypeScript)

### 1. types.ts

```typescript
// 認証関連
export interface AuthUser {
  employeeId: string;
  employeeName: string;
  role: number;
  token: string;
}

// 勤怠管理関連
export interface AttendanceData {
  employeeId: string;
  date: string;
  startTime?: string;
  endTime?: string;
}

export interface LeaveData {
  employeeId: string;
  date: string;
  leaveType: number;
  leaveTypeName?: string;
}

export interface AttendanceResponse {
  attendanceData: AttendanceData[];
  leaveData: LeaveData[];
}

// 給与管理関連
export interface SalaryData {
  employeeId: string;
  employeeName?: string;
  yearMonth: string;
  basicSalary: number;
  overtimePay: number;
  totalIncome: number;
  healthInsurance: number;
  nursingInsurance: number;
  pension: number;
  employmentInsurance: number;
  incomeTax: number;
  residentTax: number;
  totalDeduction: number;
  netAmount: number;
}

export interface SalaryHistoryItem {
  yearMonth: string;
  totalIncome: number;
  totalDeduction: number;
  netAmount: number;
}

export interface SalaryHistoryResponse {
  employeeId: string;
  employeeName: string;
  salaryHistory: SalaryHistoryItem[];
}

// 人事考課関連
export interface EvaluationData {
  employeeId: string;
  employeeName?: string;
  managerId: string;
  managerName?: string;
  yearMonth: string;
  selfEvaluation?: string;
  abilityScore?: number;
  behaviorScore?: number;
  attitudeScore?: number;
  totalScore?: number;
  managerComment?: string;
}

export interface EvaluationHistoryItem {
  yearMonth: string;
  abilityScore: number;
  behaviorScore: number;
  attitudeScore: number;
  totalScore: number;
}

export interface EvaluationHistoryResponse {
  employeeId: string;
  employeeName: string;
  evaluationHistory: EvaluationHistoryItem[];
}

// 休暇種別
export const leaveTypes = {
  1: "年次有給",
  2: "産前",
  3: "産後",
  4: "育児",
  5: "介護",
  6: "子の看護",
  7: "生理",
  8: "母性健康管理",
};
```

### 2. api.ts

```typescript
import { AttendanceData, AttendanceResponse, LeaveData, SalaryData, SalaryHistoryResponse, EvaluationData, EvaluationHistoryResponse } from './types';

const API_BASE_URL = 'http://localhost:8080/api';

// 共通の認証付きリクエスト関数
async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = sessionStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      // 認証エラーの場合はセッションをクリア
      if (response.status === 401) {
        sessionStorage.clear();
        window.location.href = '/login';
        throw new Error('認証セッションが無効です。再ログインしてください。');
      }
      
      // エラーレスポンスをパース
      const errorData = await response.json();
      throw new Error(errorData.error || 'APIエラーが発生しました');
    }
    
    return response.json();
  } catch (error) {
    console.error('API呼び出しエラー:', error);
    throw error;
  }
}

// API関数
export const api = {
  // 認証API
  login: async (employeeId: string, password: string) => {
    return fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ employeeId, password }),
    }).then(res => {
      if (!res.ok) throw new Error('ログインに失敗しました');
      return res.json();
    });
  },
  
  // 勤怠管理API
  getAttendance: async (year: number, month: number, employeeId?: string): Promise<AttendanceResponse> => {
    const params = new URLSearchParams();
    params.append('year', year.toString());
    params.append('month', month.toString());
    if (employeeId) params.append('employeeId', employeeId);
    
    return fetchWithAuth(`/attendance?${params.toString()}`);
  },
  
  saveAttendance: async (data: AttendanceData): Promise<any> => {
    return fetchWithAuth('/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  saveLeave: async (data: LeaveData): Promise<any> => {
    return fetchWithAuth('/leave', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  deleteLeave: async (employeeId: string, date: string): Promise<any> => {
    const params = new URLSearchParams();
    params.append('employeeId', employeeId);
    params.append('date', date);
    
    return fetchWithAuth(`/leave?${params.toString()}`, {
      method: 'DELETE',
    });
  },
  
  // 給与管理API
  getSalary: async (yearMonth: string, employeeId?: string): Promise<SalaryData> => {
    const params = new URLSearchParams();
    params.append('yearMonth', yearMonth);
    if (employeeId) params.append('employeeId', employeeId);
    
    return fetchWithAuth(`/salary?${params.toString()}`);
  },
  
  getSalaryHistory: async (employeeId?: string, months: number = 6): Promise<SalaryHistoryResponse> => {
    const params = new URLSearchParams();
    params.append('months', months.toString());
    if (employeeId) params.append('employeeId', employeeId);
    
    return fetchWithAuth(`/salary/history?${ fetchWithAuth(`/salary/history?${params.toString()}`);
  },
  
  // 人事考課API
  getEvaluation: async (yearMonth: string, employeeId?: string): Promise<EvaluationData> => {
    const params = new URLSearchParams();
    params.append('yearMonth', yearMonth);
    if (employeeId) params.append('employeeId', employeeId);
    
    return fetchWithAuth(`/evaluation?${params.toString()}`);
  },
  
  saveSelfEvaluation: async (employeeId: string, yearMonth: string, selfEvaluation: string): Promise<any> => {
    return fetchWithAuth('/evaluation/self', {
      method: 'POST',
      body: JSON.stringify({
        employeeId,
        yearMonth,
        selfEvaluation,
      }),
    });
  },
  
  saveManagerEvaluation: async (data: {
    employeeId: string;
    managerId: string;
    yearMonth: string;
    abilityScore: number;
    behaviorScore: number;
    attitudeScore: number;
    managerComment: string;
  }): Promise<any> => {
    return fetchWithAuth('/evaluation/manager', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  getEvaluationHistory: async (employeeId?: string, count: number = 6): Promise<EvaluationHistoryResponse> => {
    const params = new URLSearchParams();
    params.append('count', count.toString());
    if (employeeId) params.append('employeeId', employeeId);
    
    return fetchWithAuth(`/evaluation/history?${params.toString()}`);
  },
};
```

### 3. AuthContext.tsx

```tsx
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser } from './types';

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (userData: AuthUser) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  login: () => {},
  logout: () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  
  // 初期化時に保存されたトークンがあれば復元
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const employeeId = sessionStorage.getItem('employeeId');
    const employeeName = sessionStorage.getItem('employeeName');
    const roleStr = sessionStorage.getItem('role');
    
    if (token && employeeId && employeeName && roleStr) {
      const role = parseInt(roleStr, 10);
      setIsAuthenticated(true);
      setUser({
        employeeId,
        employeeName,
        role,
        token,
      });
    }
  }, []);
  
  const login = (userData: AuthUser) => {
    sessionStorage.setItem('token', userData.token);
    sessionStorage.setItem('employeeId', userData.employeeId);
    sessionStorage.setItem('employeeName', userData.employeeName);
    sessionStorage.setItem('role', userData.role.toString());
    
    setIsAuthenticated(true);
    setUser(userData);
  };
  
  const logout = () => {
    sessionStorage.clear();
    setIsAuthenticated(false);
    setUser(null);
  };
  
  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 4. useAuth.ts

```typescript
import { useContext } from 'react';
import { AuthContext } from './AuthContext';

export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};
```

### 5. components/common.css

```css
/* 全体のスタイル */
body {
  font-family: 'Noto Sans JP', sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f5f7fa;
  color: #333;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* ヘッダー */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #2c3e50;
  color: white;
  padding: 10px 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-info span {
  margin-right: 20px;
}

.logout-button {
  background-color: transparent;
  border: 1px solid white;
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.logout-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

/* フッター */
.footer {
  text-align: center;
  padding: -align: center;
  padding: 10px 0;
  font-size: 0.8rem;
  color: #666;
  margin-top: 40px;
  border-top: 1px solid #eee;
}

/* ログイン画面 */
.login-container {
  max-width: 400px;
  margin: 100px auto;
  padding: 30px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.login-container h2 {
  text-align: center;
  margin-bottom: 30px;
  color: #2c3e50;
}

.login-form .form-group {
  margin-bottom: 20px;
}

.login-form label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.login-form input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.login-form button {
  width: 100%;
  padding: 12px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.login-form button:hover {
  background-color: #2980b9;
}

.error-message {
  color: #e74c3c;
  font-size: 14px;
  margin-top: 10px;
  text-align: center;
}

/* メイン画面 */
.main-container {
  padding: 30px;
}

.main-title {
  text-align: center;
  margin-bottom: 40px;
  color: #2c3e50;
}

.nav-cards {
  display: flex;
  justify-content: center;
  gap: 30px;
  flex-wrap: wrap;
}

.nav-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 300px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
}

.nav-card:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.nav-card-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  color: #3498db;
}

.nav-card h3 {
  margin: 0 0 10px 0;
  color: #2c3e50;
}

.nav-card p {
  color: #7f8c8d;
}

/* 共通コンポーネント */
.page-title {
  color: #2c3e50;
  margin-bottom: 30px;
  text-align: center;
}

.section-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
}

.section-title {
  margin-top: 0;
  margin-bottom: 15px;
  color: #2c3e50;
  font-size: 1.2rem;
}

.form-button {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.form-button:hover {
  background-color: #2980b9;
}

.form-button.secondary {
  background-color: #95a5a6;
}

.form-button.secondary:hover {
  background-color: #7f8c8d;
}

.form-button.delete {
  background-color: #e74c3c;
}

.form-button.delete:hover {
  background-color: #c0392b;
}

/* テーブルスタイル */
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th, .data-table td {
  border: 1px solid #ddd;
  padding: 10px;
  text-align: left;
}

.data-table th {
  background-color: #f2f2f2;
  font-weight: 500;
}

.data-table tr:nth-child(even) {
  background-color: #f9f9f9;
}

.data-table tr:hover {
  background-color: #f1f1f1;
}

/* フォーム要素 */
.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.form-group input, .form-group select, .form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group textarea {
  min-height: 100px;
}

/* カレンダースタイル */
.calendar-container {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background-color: #3498db;
  color: white;
}

.calendar-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.calendar-header button {
  background-color: transparent;
  border: 1px solid white;
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.calendar-header button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background-color: #f2f2f2;
  border-bottom: 1px solid #ddd;
}

.weekday {
  text-align: center;
  padding: 10px;
  font-weight: 500;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: minmax(80px, auto);
}

.calendar-cell {
  border: 1px solid #ddd;
  padding: 5px;
  min-height: 80px;
  position: relative;
}

.calendar-cell.current-month {
  background-color: white;
}

.calendar-cell.other-month {
  background-color: #f9f9f9;
  color: #999;
}

.calendar-cell.leave-day {
  background-color: #ffe6e6;
}

.calendar-cell .date {
  font-weight: 500;
  text-align: right;
  margin-bottom: 5px;
}

.calendar-cell .attendance-time {
  font-size: 12px;
  color: #3498db;
}

.calendar-cell .leave-badge {
  position: absolute;
  bottom: 5px;
  left: 5px;
  background-color: #e74c3c;
  color: white;
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 10px;
}

/* 給与明細スタイル */
.salary-detail {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
}

.salary-section {
  margin-bottom: 20px;
}

.salary-section h3 {
  margin-top: 0;
  border-bottom: 1px solid #ddd;
  padding-bottom: 10px;
  margin-bottom: 15px;
}

.salary-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.salary-total {
  font-weight: bold;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
}

.salary-net-amount {
  font-size: 1.2rem;
  font-weight: bold;
  text-align: right;
  color: #2c3e50;
  margin-top: 20px;
  padding-top: 10px;
  border-top: 2px solid #ddd;
}

/* 評価フォームスタイル */
.evaluation-score {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.evaluation-score-item {
  flex: 1;
}

.score-buttons {
  display: flex;
  gap: 5px;
}

.score-button {
  flex: 1;
  padding: 5px;
  border: 1px solid #ddd;
  background-color: white;
  border-radius: 4px;
  cursor: pointer;
}

.score-button.selected {
  background-color: #3498db;
  color: white;
  border-color: #3498db;
}

/* 履歴表示スタイル */
.history-chart {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-top: 20px;
}

.chart-title {
  margin-top: 0;
  margin-bottom: 15px;
  text-align: center;
}

/* レスポンシブ対応 */
@media (max-width: 768px) {
  .container {
    padding: 10px;
  }
  
  .login-container {
    margin: 50px auto;
    padding: 20px;
  }
  
  .nav-cards {
    flex-direction: column;
    align-items: center;
  }
  
  .nav-card {
    width: 100%;
    max-width: 300px;
  }
  
  .calendar-days {
    grid-auto-rows: minmax(60px, auto);
  }
  
  .calendar-cell {
    min-height: 60px;
  }
}
```

### 6. components/Login.tsx

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../useAuth';
import './common.css';

const Login: React.FC = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employeeId || !password) {
      setError('社員IDとパスワードを入力してください');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const data = await api.login(employeeId, password);
      login(data);
      navigate('/main');
    } catch (err) {
      setError('ログインに失敗しました。社員IDとパスワードを確認してください。');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="login-container">
      <h2>人事システム ログイン</h2>
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="employeeId">社員ID</label>
          <input
            type="text"
            id="employeeId"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">パスワード</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </div>
  );
};

export default Login;
```

### 7. components/Main.tsx

```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import './common.css';

// ナビゲーションカードコンポーネント
interface NavCardProps {
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}

const NavCard: React.FC<NavCardProps> = ({ title, description, icon, onClick }) => {
  return (
    <div className="nav-card" onClick={onClick}>
      <div className="nav-card-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
};

const Main: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  return (
    <div>
      <header className="header">
        <h1>人事システム</h1>
        <div className="user-info">
          <span>{user?.employeeName} さん</span>
          <button className="logout-button" onClick={logout}>ログアウト</button>
        </div>
      </header>
      
      <div className="container main-container">
        <h2 className="main-title">メインメニュー</h2>
        
        <div className="nav-cards">
          <NavCard
            title="勤怠管理"
            description="勤怠情報の登録・確認、休暇申請ができます"
            icon="📅"
            onClick={() => navigate('/kintai')}
          />
          
          <NavCard
            title="給与管理"
            description="給与明細の確認、給与履歴の閲覧ができます"
            icon="💰"
            onClick={() => navigate('/kyuyo')}
          />
          
          <NavCard
            title="人事考課"
            description="目標設定・評価・フィードバックの確認ができます"
            icon="📊"
            onClick={() => navigate('/kouka')}
          />
        </div>
      </div>
      
      <footer className="footer">
        <p>&copy; 2025 人事システム All Rights Reserved.</p>
      </footer>
    </div>
  );
};

export default Main;
```

### 8. components/Kintai.tsx

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../useAuth';
import { AttendanceData, LeaveData, leaveTypes } from '../types';
import './common.css';

// カレンダーコンポーネント
interface CalendarProps {
  year: number;
  month: number;
  attendanceData: AttendanceData[];
  leaveData: LeaveData[];
  onDateSelect: (date: Date) => void;
  onMonthChange: (year: number, month: number) => void;
}

const Calendar: React.FC<CalendarProps> = ({
  year,
  month,
  attendanceData,
  leaveData,
  onDateSelect,
  onMonthChange,
}) => {
  // カレンダーデータの計算
  const calendarDays = useMemo(() => {
    // 月の最初の日と最後の日を計算
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    
    // 前月の余白日を計算
    const prevMonthDays = [];
    const firstDayOfWeek = firstDay.getDay();
    const prevDaysCount = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    for (let i = prevDaysCount - 1; i >= 0; i--) {
      const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
      const day = new Date(year, month - 2, prevMonthLastDay - i);
      prevMonthDays.push(day);
    }
    
    // 当月の日を計算
    const currentMonthDays = [];
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const day = new Date(year, month - 1, i);
      currentMonthDays.push(day);
    }
    
    // 翌月の余白日を計算
    const nextMonthDays = [];
    const lastDayOfWeek = lastDay.getDay();
    const nextDaysCount = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
    for (let i = 1; i <= nextDaysCount; i++) {
      const day = new Date(year, month, i);
      nextMonthDays.push(day);
    }
    
    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  }, [year, month]);
  
  // 日付をYYYY-MMyear, month]);
  
  //-DD形式に変換
  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  
  // 日付セルのレンダリング
  const renderDateCell = (date: Date) => {
    const isCurrentMonth = date.getMonth() === month - 1;
    const dateKey = formatDate(date);
    
    // 日付に対応する勤怠データを探す
    const attendance = attendanceData.find(a => a.date === dateKey);
    
    // 日付に対応する休暇データを探す
    const leave = leaveData.find(l => l.date === dateKey);
    
    return (
      <div 
        key={dateKey}
        className={`calendar-cell ${isCurrentMonth ? 'current-month' : 'other-month'} ${leave ? 'leave-day' : ''}`}
        onClick={() => onDateSelect(date)}
      >
        <div className="date">{date.getDate()}</div>
        {attendance && (
          <div className="attendance-time">
            {attendance.startTime?.substring(0, 5)}
            {attendance.endTime && ` - ${attendance.endTime.substring(0, 5)}`}
          </div>
        )}
        {leave && (
          <div className="leave-badge">{leaveTypes[leave.leaveType as keyof typeof leaveTypes]}</div>
        )}
      </div>
    );
  };
  
  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button onClick={() => onMonthChange(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)}>前月</button>
        <h2>{year}年{month}月</h2>
        <button onClick={() => onMonthChange(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)}>翌月</button>
      </div>
      
      <div className="calendar-weekdays">
        <div className="weekday">月</div>
        <div className="weekday">火</div>
        <div className="weekday">水</div>
        <div className="weekday">木</div>
        <div className="weekday">金</div>
        <div className="weekday">土</div>
        <div className="weekday">日</div>
      </div>
      
      <div className="calendar-days">
        {calendarDays.map(date => renderDateCell(date))}
      </div>
    </div>
  );
};

// 勤怠入力フォームコンポーネント
interface AttendanceFormProps {
  selectedDate: Date;
  attendanceData?: AttendanceData;
  leaveData?: LeaveData;
  onSaveAttendance: (data: AttendanceData) => void;
  onSaveLeave: (data: LeaveData) => void;
  onDeleteLeave: () => void;
}

const AttendanceForm: React.FC<AttendanceFormProps> = ({
  selectedDate,
  attendanceData,
  leaveData,
  onSaveAttendance,
  onSaveLeave,
  onDeleteLeave,
}) => {
  const [startTime, setStartTime] = useState(attendanceData?.startTime?.substring(0, 5) || '');
  const [endTime, setEndTime] = useState(attendanceData?.endTime?.substring(0, 5) || '');
  const [leaveType, setLeaveType] = useState(leaveData?.leaveType || 0);
  const { user } = useAuth();
  
  // 選択日が変わったら入力値を更新
  useEffect(() => {
    setStartTime(attendanceData?.startTime?.substring(0, 5) || '');
    setEndTime(attendanceData?.endTime?.substring(0, 5) || '');
    setLeaveType(leaveData?.leaveType || 0);
  }, [selectedDate, attendanceData, leaveData]);
  
  // 日付を表示用にフォーマット
  const formatDisplayDate = (date: Date): string => {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };
  
  // 日付をAPI用にフォーマット
  const formatApiDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  
  // 勤怠情報保存
  const handleSaveAttendance = () => {
    // バリデーション
    if (endTime && startTime && endTime < startTime) {
      alert('終了時刻は開始時刻より後にしてください');
      return;
    }
    
    onSaveAttendance({
      employeeId: user?.employeeId || '',
      date: formatApiDate(selectedDate),
      startTime: startTime ? `${startTime}:00` : undefined,
      endTime: endTime ? `${endTime}:00` : undefined,
    });
  };
  
  // 休暇情報保存
  const handleSaveLeave = () => {
    if (leaveType === 0) {
      alert('休暇種別を選択してください');
      return;
    }
    
    onSaveLeave({
      employeeId: user?.employeeId || '',
      date: formatApiDate(selectedDate),
      leaveType,
    });
  };
  
  return (
    <div className="section-card">
      <h3 className="section-title">{formatDisplayDate(selectedDate)}の勤怠情報</h3>
      
      <div className="form-section">
        <h4>勤怠時間</h4>
        <div className="form-group">
          <label>出勤時間</label>
          <input 
            type="time" 
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>退勤時間</label>
          <input 
            type="time" 
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
        <button className="form-button" onClick={handleSaveAttendance}>勤怠を保存</button>
      </div>
      
      <div className="form-section" style={{ marginTop: '20px' }}>
        <h4>休暇申請</h4>
        <div className="form-group">
          <label>休暇種別</label>
          <select 
            value={leaveType}
            onChange={(e) => setLeaveType(parseInt(e.target.value, 10))}
          >
            <option value="0">選択してください</option>
            {Object.entries(leaveTypes).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="form-button" onClick={handleSaveLeave}>休暇を申請</button>
          {leaveData && (
            <button className="form-button delete" onClick={onDeleteLeave}>休暇を取消</button>
          )}
        </div>
      </div>
    </div>
  );
};

// 勤怠管理画面メインコンポーネント
const Kintai: React.FC = () => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [leaveData, setLeaveData] = useState<LeaveData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // 選択中の日付の勤怠データ
  const currentAttendance = useMemo(() => {
    const dateStr = formatApiDate(selectedDate);
    return attendanceData.find(item => item.date === dateStr);
  }, [selectedDate, attendanceData]);
  
  // 選択中の日付の休暇データ
  const currentLeave = useMemo(() => {
    const dateStr = formatApiDate(selectedDate);
    return leaveData.find(item => item.date === dateStr);
  }, [selectedDate, leaveData]);
  
  // 日付をAPI用にフォーマット
  const formatApiDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  
  // 勤怠データを取得
  const fetchAttendanceData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await api.getAttendance(year, month);
      setAttendanceData(response.attendanceData);
      setLeaveData(response.leaveData);
    } catch (err) {
      console.error('Error fetching attendance data:', err);
      setError('勤怠データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 初回ロード時と年月が変わったときにデータを取得
  useEffect(() => {
    fetchAttendanceData();
  }, [year, month]);
  
  // 月変更ハンドラ
  const handleMonthChange = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  };
  
  // 勤怠情報保存ハンドラ
  const handleSaveAttendance = async (data: AttendanceData) => {
    try {
      await api.saveAttendance(data);
      fetchAttendanceData();
      alert('勤怠情報を保存しました');
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      alert(`勤怠情報の保存に失敗しました: ${err.message}`);
    }
  };
  
  // 休暇情報保存ハンドラ
  const handleSaveLeave = async (data: LeaveData) => {
    try {
      await api.saveLeave(data);
      fetchAttendanceData();
      alert('休暇情報を登録しました');
    } catch (err: any) {
      console.error('Error saving leave:', err);
      alert(`休暇情報の登録に失敗しました: ${err.message}`);
    }
  };
  
  // 休暇情報削除ハンドラ
  const handleDeleteLeave = async () => {
    if (!currentLeave) return;
    
    try {
      await api.deleteLeave(user?.employeeId || '', formatApiDate(selectedDate));
      fetchAttendanceData();
      alert('休暇情報を削除しました');
    } catch (err: any) {
      console.error('Error deleting leave:', err);
      alert(`休暇情報の削除に失敗しました: ${err.message}`);
    }
  };
  
  return (
    <div>
      <header className="header">
        <h1>人事システム</h1>
        <div className="user-info">
          <span>{user?.employeeName} さん</span>
          <button className="logout-button" onClick={() => navigate('/main')}>メインメニュー</button>
        </div>
      </header>
      
      <div className="container">
        <h2 className="page-title">勤怠管理</h2>
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>データを読み込み中...</div>
        ) : error ? (
          <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ flex: '1 1 60%', minWidth: '300px' }}>
              <Calendar
                year={year}
                month={month}
                attendanceData={attendanceData}
                leaveData={leaveData}
                onDateSelect={setSelectedDate}
                onMonthChange={handleMonthChange}
              />
            </div>
            
            <div style={{ flex: '1 1 35%', minWidth: '300px' }}>
              <AttendanceForm
                selectedDate={selectedDate}
                attendanceData={currentAttendance}
                leaveData={currentLeave}
                onSaveAttendance={handleSaveAttendance}
                onSaveLeave={handleSaveLeave}
                onDeleteLeave={handleDeleteLeave}
              />
              
              <div className="section-card">
                <h3 className="section-title">休暇取得状況</h3>
                {leaveData.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>日付</th>
                        <th>休暇種別</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveData.map((leave) => (
                        <tr key={leave.date}>
                          <td>{leave.date}</td>
                          <td>{leaveTypes[leave.leaveType as keyof typeof leaveTypes]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>表示する休暇情報がありません</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <footer className="footer">
        <p>&copy; 2025 人事システム All Rights Reserved.</p>
      </footer>
    </div>
  );
};

export default Kintai;
```

### 9. components/Kyuyo.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../useAuth';
import { SalaryData, SalaryHistoryItem } from '../types';
import './common.css';

// 月選択コンポーネント
interface MonthSelectorProps {
  yearMonth: string;
  onYearMonthChange: (newYearMonth: string) => void;
}

const MonthSelector: React.FC<MonthSelectorProps> = ({ yearMonth, onYearMonthChange }) => {
  const [year, setYear] = useState<number>(parseInt(yearMonth.substring(0, 4)));
  const [month, setMonth] = useState<number>(parseInt(yearMonth.substring(4, 6)));
  
  // 年月が変わったらpropsに通知
  useEffect(() => {
    const newYearMonth = `${year}${month.toString().padStart(2, '0')}`;
    if (newYearMonth !== yearMonth) {
      onYearMonthChange(newYearMonth);
    }
  }, [year, month]);
  
  // 年の選択肢を生成
  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 5; y <= currentYear; y++) {
    yearOptions.push(y);
  }
  
  // 月の選択肢
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  
  return (
    <div className="section-card">
      <h3 className="section-title">表示する年月を選択</h3>
      <div style={{ display: 'flex', gap: '10px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>年</label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>月</label>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
          >
            {months.map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

// 給与明細コンポーネント
interface SalaryDetailProps {
  salaryData: SalaryData;
}

const SalaryDetail: React.FC<SalaryDetailProps> = ({ salaryData }) => {
  // 年月をYYYY年MM月形式に変換
  const formatYearMonth = (yearMonth: string): string => {
    return `${yearMonth.substring(0, 4)}年${yearMonth.substring(4, 6)}月`;
  };
  
  // 金額をカンマ区切りで表示
  const formatAmount = (amount: number): string => {
    return amount.toLocaleString() + ' 円';
  };
  
  return (
    <div className="salary-detail">
      <h3 className="section-title">{formatYearMonth(salaryData.yearMonth)} 給与明細</h3>
      
      <div className="salary-section">
        <h3>収入項目</h3>
        <div className="salary-item">
          <span>基本給</span>
          <span>{formatAmount(salaryData.basicSalary)}</span>
        </div>
        <div className="salary-item">
          <span>残業手当</span>
          <span>{formatAmount(salaryData.overtimePay)}</span>
        </div>
        <div className="salary-item salary-total">
          <span>収入合計</span>
          <span>{formatAmount(salaryData.totalIncome)}</span>
        </div>
      </div>
      
      <div className="salary-section">
        <h3>控除項目</h3>
        <div className="salary-item">
          <span>健康保険料</span>
          <span>{formatAmount(salaryData.healthInsurance)}</span>
        </div>
        <div className="salary-item">
          <span>介護保険料</span>
          <span>{formatAmount(salaryData.nursingInsurance)}</span>
        </div>
        <div className="salary-item">
          <span>厚生年金</span>
          <span>{formatAmount(salaryData.pension)}</span>
        </div>
        <div className="salary-item">
          <span>雇用保険料</span>
          <span>{formatAmount(salaryData.employmentInsurance)}</span>
        </div>
        <div className="salary-item">
          <span>所得税</span>
          <span>{formatAmount(salaryData.incomeTax)}</span>
        </div>
        <div className="salary-item">
          <span>住民税</span>
          <span>{formatAmount(salaryData.residentTax)}</span>
        </div>
        <div className="salary-item salary-total">
          <span>控除合計</span>
          <span>{formatAmount(salaryData.totalDeduction)}</span>
        </div>
      </div>
      
      <div className="salary-net-amount">
        <span>差引支給額</span>
        <span>{formatAmount(salaryData.netAmount)}</span>
      </div>
    </div>
  );
};

// 給与履歴コンポーネント
interface SalaryHistoryProps {
  historyData: SalaryHistoryItem[];
}

const SalaryHistory: React.FC<SalaryHistoryProps> = ({ historyData }) => {
  // 年月をYYYY年MM月形式に変換
  const formatYearMonth = (yearMonth: string): string => {
    return `${yearMonth.substring(0, 4)}年${yearMonth.substring(4, 6)}月`;
  };
  
  return (
    <div className="section-card">
      <h3 className="section-title">給与履歴</h3>
      {historyData.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>年月</th>
              <th>収入合計</th>
              <th>控除合計</th>
              <th>差引支給額</th>
            </tr>
          </thead>
          <tbody>
            {historyData.map((item) => (
              <tr key={item.yearMonth}>
                <td>{formatYearMonth(item.yearMonth)}</td>
                <td>{item.totalIncome.toLocaleString()} 円</td>
                <td>{item.totalDeduction.toLocaleString()} 円</td>
                <td>{item.netAmount.toLocaleString()} 円</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>表示する給与履歴がありません</p>
      )}
    </div>
  );
};

// 給与管理画面メインコンポーネント
const Kyuyo: React.FC = () => {
  // 現在の年月をYYYYMM形式で取得
  const getCurrentYearMonth = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}${month}`;
  };
  
  const [yearMonth, setYearMonth] = useState<string>(getCurrentYearMonth());
  const [salaryData, setSalaryData] = useState<SalaryData | null>(null);
  const [historyData, setHistoryData] = useState<SalaryHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // 給与データを取得
  const fetchSalaryData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const data = await api.getSalary(yearMonth);
      setSalaryData(data);
    } catch (err: any) {
      console.error('Error fetching salary data:', err);
      setSalaryData(null);
      if (err.message.includes('見つかりません')) {
        setError(`${yearMonth.substring(0, 4)}年${yearMonth.substring(4, 6)}月の給与情報はまだ登録されていません`);
      } else {
        setError('給与データの取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // 給与履歴を取得
  const fetchSalaryHistory = async () => {
    try {
      const response = await api.getSalaryHistory();
      setHistoryData(response.salaryHistory);
    } catch (err) {
      console.error('Error fetching salary history:', err);
      setHistoryData([]);
    }
  };
  
  // 初回ロード時にデータを取得
  useEffect(() => {
    fetchSalaryHistory();
  }, []);
  
  // 年月が変わったときに給与データを再取得
  useEffect(() => {
    fetchSalaryData();
  }, [yearMonth]);
  
  return (
    <div>
      <header className="header">
        <h1>人事システム</h1>
        <div className="user-info">
          <span>{user?.employeeName} さん</span>
          <button className="logout-button" onClick={() => navigate('/main')}>メインメニュー</button>
        </div>
      </header>
      
      <div className="container">
        <h2 className="page-title">給与管理</h2>
        
        <MonthSelector
          yearMonth={yearMonth}
          onYearMonthChange={setYearMonth}
        />
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>データを読み込み中...</div>
        ) : error ? (
          <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</div>
        ) : salaryData ? (
          <SalaryDetail salaryData={salaryData} />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>給与データがありません</div>
        )}
        
        <SalaryHistory historyData={historyData} />
      </div>
      
      <footer className="footer">
        <p>&copy; 2025 人事システム All Rights Reserved.</p>
      </footer>
    </div>
  );
};

export default Kyuyo;
```

### 10. components/Kouka.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../useAuth';
import { EvaluationData, EvaluationHistoryItem } from '../types';
import './common.css';

// 月選択コンポーネント
interface MonthSelectorProps {
  yearMonth: string;
  onYearMonthChange: (newYearMonth: string) => void;
}

const MonthSelector: React.FC<MonthSelectorProps> = ({ yearMonth, onYearMonthChange }) => {
  const [year, setYear] = useState<number>(parseInt(yearMonth.substring(0, 4)));
  const [month, setMonth] = useState<number>(parseInt(yearMonth.substring(4, 6)));
  
  // 年月が変わったらpropsに通知
  useEffect(() => {
    const newYearMonth = `${year}${month.toString().padStart(2, '0')}`;
    if (newYearMonth !== yearMonth) {
      onYearMonthChange(newYearMonth);
    }
  }, [year, month]);
  
  // 年の選択肢を生成
  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 5; y <= currentYear; y++) {
    yearOptions.push(y);
  }
  
  // 月の選択肢
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  
  return (
    <div className="section-card">
      <h3 className="section-title">表示する年月を選択</h3>
      <div style={{ display: 'flex', gap: '10px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>年</label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>月</label>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
          >
            {months.map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

// 自己評価フォームコンポーネント
interface SelfEvaluationFormProps {
  employeeId: string;
  yearMonth: string;
  selfEvaluation: string;
  onSave: (selfEvaluation: string) => void;
}

const SelfEvaluationForm: React.FC<SelfEvaluationFormProps> = ({
  employeeId,
  yearMonth,
  selfEvaluation,
  onSave,
}) => {
  const [inputValue, setInputValue] = useState(selfEvaluation || '');
  const maxLength = 256;
  
  // 親コンポーネントから渡される値が変わったら更新
  useEffect(() => {
    setInputValue(selfEvaluation || '');
  }, [selfEvaluation]);
  
  return (
    <div className="section-card">
      <h3 className="section-title">自己評価・目標入力</h3>
      <div className="form-group">
        <label>自己評価・目標</label>
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          maxLength={maxLength}
          placeholder="今月の業務内容や成果、次月の目標などを入力してください"
        />
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#666' }}>
          {inputValue.length}/{maxLength}文字
        </div>
      </div>
      
      <button 
        className="form-button"
        onClick={() => onSave(inputValue)}
        disabled={!inputValue.trim()}
      >
        保存する
      </button>
    </div>
  );
};

// 上司評価フォームコンポーネント
interface ManagerEvaluationFormProps {
  evaluationData: EvaluationData;
  onSave: (data: {
    abilityScore: number;
    behaviorScore: number;
    attitudeScore: number;
    managerComment: string;
  }) => void;
}

const ManagerEvaluationForm: React.FC<ManagerEvaluationFormProps> = ({
  evaluationData,
  onSave,
}) => {
  const [abilityScore, setAbilityScore] = useState(evaluationData.abilityScore || 3);
  const [behaviorScore, setBehaviorScore] = useState(evaluationData.behaviorScore || 3);
  const [attitudeScore, setAttitudeScore] = useState(evaluationData.attitudeScore || 3);
  const [managerComment, setManagerComment] = useState(evaluationData.managerComment || '');
  const maxLength = 256;
  
  // 親コンポーネントから渡される値が変わったら更新
  useEffect(() => {
    setAbilityScore(evaluationData.abilityScore || 3);
    setBehaviorScore(evaluationData.behaviorScore || 3);
    setAttitudeScore(evaluationData.attitudeScore || 3);
    setManagerComment(evaluationData.managerComment || '');
  }, [evaluationData]);
  
  // スコアボタンコンポーネント
  const ScoreButtons = ({ value, onChange }: { value: number, onChange: (value: number) => void }) => {
    return (
      <div className="score-buttons">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            className={`score-button ${score === value ? 'selected' : ''}`}
            onClick={() => onChange(score)}
          >
            {score}
          </button>
        ))}
      </div>
    );
  };
  
  const handleSave = () => {
    onSave({
      abilityScore,
      behaviorScore,
      attitudeScore,
      managerComment,
    });
  };
  
  return (
    <div className="section-card">
      <h3 className="section-title">評価入力</h3>
      
      <div className="evaluation-score">
        <div className="evaluation-score-item">
          <label>能力評価</label>
          <ScoreButtons value={abilityScore} onChange={setAbilityScore} />
        </div>
        <div className="evaluation-score-item">
          <label>行動評価</label>
          <ScoreButtons value={behaviorScore} onChange={setBehaviorScore} />
        </div>
        <div className="evaluation-score-item">
          <label>態度評価</label>
          <ScoreButtons value={attitudeScore} onChange={setAttitudeScore} />
        </div>
      </div>
      
      <div className="form-group">
        <label>評価コメント</label>
        <textarea
          value={managerComment}
          onChange={(e) => setManagerComment(e.target.value)}
          maxLength={maxLength}
          placeholder="部下への評価コメントを入力してください"
        />
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#666' }}>
          {managerComment.length}/{maxLength}文字
        </div>
      </div>
      
      <button className="form-button" onClick={handleSave}>
        評価を保存
      </button>
    </div>
  );
};

// 評価結果表示コンポーネント
interface EvaluationResultProps {
  evaluationData: EvaluationData;
}

const EvaluationResult: React.FC<EvaluationResultProps> = ({ evaluationData }) => {
  // 年月をYYYY年MM月形式に変換
  const formatYearMonth = (yearMonth: string): string => {
    return `${yearMonth.substring(0, 4)}年${yearMonth.substring(4, 6)}月`;
  };
  
  return (
    <div className="section-card">
      <h3 className="section-title">{formatYearMonth(evaluationData.yearMonth)}の評価結果</h3>
      
      {evaluationData.selfEvaluation && (
        <div className="evaluation-section">
          <h4>自己評価</h4>
          <p>{evaluationData.selfEvaluation}</p>
        </div>
      )}
      
      {(evaluationData.abilityScore || evaluationData.behaviorScore || evaluationData.attitudeScore) && (
        <div className="evaluation-section">
          <h4>評価スコア</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>能力評価</th>
                <th>行動評価</th>
                <th>態度評価</th>
                <th>合計</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{evaluationData.abilityScore || '-'}</td>
                <td>{evaluationData.behaviorScore || '-'}</td>
                <td>{evaluationData.attitudeScore || '-'}</td>
                <td>{evaluationData.totalScore || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      
      {evaluationData.managerComment && (
        <div className="evaluation-section">
          <h4>上司コメント</h4>
          <p>{evaluationData.managerComment}</p>
        </div>
      )}
    </div>
  );
};

// 評価履歴表示コンポーネント
interface EvaluationHistoryProps {
  historyData: EvaluationHistoryItem[];
}

const EvaluationHistory: React.FC<EvaluationHistoryProps> = ({ historyData }) => {
  // 年月をYYYY年MM月形式に変換
  const formatYearMonth = (yearMonth: string): string => {
    return `${yearMonth.substring(0, 4)}年${yearMonth.substring(4, 6)}月`;
  };
  
  return (
    <div className="section-card">
      <h3 className="section-title">評価履歴</h3>
      {historyData.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>年月</th>
              <th>能力評価</th>
              <th>行動評価</th>
              <th>態度評価</th>
              <th>合計</th>
            </tr>
          </thead>
          <tbody>
            {historyData.map((item) => (
              <tr key={item.yearMonth}>
                <td>{formatYearMonth(item.yearMonth)}</td>
                <td>{item.abilityScore}</td>
                <td>{item.behaviorScore}</td>
                <td>{item.attitudeScore}</td>
                <td>{item.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>表示する評価履歴がありません</p>
      )}
    </div>
  );
};

// 人事考課画面メインコンポーネント
const Kouka: React.FC = () => {
  // 現在の年月をYYYYMM形式で取得
  const getCurrentYearMonth = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}${month}`;
  };
  
  const [yearMonth, setYearMonth] = useState<string>(getCurrentYearMonth());
  const [evaluationData, setEvaluationData] = useState<EvaluationData | null>(null);
  const [historyData, setHistoryData] = useState<EvaluationHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [target, setTarget] = useState<string>(''); // 評価対象者ID
  
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // 評価データを取得
  const fetchEvaluationData = async (targetId?: string) => {
    setIsLoading(true);
    setError('');
    
    try {
      const data = await api.getEvaluation(yearMonth, targetId);
      setEvaluationData(data);
      if (targetId) setTarget(targetId);
    } catch (err: any) {
      console.error('Error fetching evaluation data:', err);
      setEvaluationData(null);
      setError('評価データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 評価履歴を取得
  const fetchEvaluationHistory = async (targetId?: string) => {
    try {
      const response = await api.getEvaluationHistory(targetId);
      setHistoryData(response.evaluationHistory);
    } catch (err) {
      console.error('Error fetching evaluation history:', err);
      setHistoryData([]);
    }
  };
  
  // 初回ロード時にデータを取得
  useEffect(() => {
    fetchEvaluationData();
    fetchEvaluationHistory();
  }, []);
  
  // 年月が変わったときに評価データを再取得
  useEffect(() => {
    if (target) {
      fetchEvaluationData(target);
    } else {
      fetchEvaluationData();
    }
  }, [yearMonth]);
  
  // 自己評価を保存
  const handleSaveSelfEvaluation = async (selfEvaluation: string) => {
    if (!user || !evaluationData) return;
    
    try {
      await api.saveSelfEvaluation(user.employeeId, yearMonth, selfEvaluation);
      fetchEvaluationData(); // データを再取得
      alert('自己評価を保存しました');
    } catch (err: any) {
      console.error('Error saving self evaluation:', err);
      alert(`自己評価の保存に失敗しました: ${err.message}`);
    }
  };
  
  // 上司評価を保存
  const handleSaveManagerEvaluation = async (data: {
    abilityScore: number;
    behaviorScore: number;
    attitudeScore: number;
    managerComment: string;
  }) => {
    if (!user || !evaluationData) return;
    
    try {
      await api.saveManagerEvaluation({
        employeeId: evaluationData.employeeId,
        managerId: user.employeeId,
        yearMonth: evaluationData.yearMonth,
        ...data,
      });
      fetchEvaluationData(evaluationData.employeeId); // データを再取得
      fetchEvaluationHistory(evaluationData.employeeId); // 履歴も再取得
      alert('評価を保存しました');
    } catch (err: any) {
      console.error('Error saving manager evaluation:', err);
      alert(`評価の保存に失敗しました: ${err.message}`);
    }
  };
  
  return (
    <div>
      <header className="header">
        <h1>人事システム</h1>
        <div className="user-info">
          <span>{user?.employeeName} さん</span>
          <button className="logout-button" onClick={() => navigate('/main')}>メインメニュー</button>
        </div>
      </header>
      
      <div className="container">
        <h2 className="page-title">人事考課</h2>
        
        {/* 上司向け：評価対象者選択（仮実装：実際には部下一覧からの選択UIを実装） */}
        {user?.role && user.role >= 2 && (
          <div className="section-card">
            <h3 className="section-title">評価対象者選択</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="form-button"
                onClick={() => {
                  fetchEvaluationData();
                  fetchEvaluationHistory();
                  setTarget('');
                }}
              >
                自分の評価を表示
              </button>
              <button 
                className="form-button"
                onClick={() => {
                  // 仮の部下ID（実際のシステムでは動的に取得）
                  const subordinateId = "10002";
                  fetchEvaluationData(subordinateId);
                  fetchEvaluationHistory(subordinateId);
                }}
              >
                部下の評価を表示
              </button>
            </div>
          </div>
        )}
        
        <MonthSelector
          yearMonth={yearMonth}
          onYearMonthChange={setYearMonth}
        />
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>データを読み込み中...</div>
        ) : error ? (
          <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</div>
        ) : evaluationData ? (
          <>
            {/* 評価対象者情報 */}
            <div className="section-card">
              <h3 className="section-title">評価情報</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <p><strong>社員名:</strong> {evaluationData.employeeName}</p>
                  <p><strong>社員ID:</strong> {evaluationData.employeeId}</p>
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <p><strong>上司名:</strong> {evaluationData.managerName || '未設定'}</p>
                  <p><strong>評価期間:</strong> {yearMonth.substring(0, 4)}年{yearMonth.substring(4, 6)}月</p>
                </div>
              </div>
            </div>
            
            {/* 自己評価フォーム（自分自身の評価画面を見ている場合のみ表示） */}
            {(!target || target === user?.employeeId) && (
              <SelfEvaluationForm
                employeeId={evaluationData.employeeId}
                yearMonth={evaluationData.yearMonth}
                selfEvaluation={evaluationData.selfEvaluation || ''}
                onSave={handleSaveSelfEvaluation}
              />
            )}
            
            {/* 上司評価フォーム（上司が部下の評価を見ている場合のみ表示） */}
            {user?.role && user.role >= 2 && target && target !== user.employeeId && (
              <ManagerEvaluationForm
                evaluationData={evaluationData}
                onSave={handleSaveManagerEvaluation}
              />
            )}
            
            {/* 評価結果表示 */}
            {(evaluationData.selfEvaluation || 
              evaluationData.abilityScore || 
              evaluationData.behaviorScore || 
              evaluationData.attitudeScore || 
              evaluationData.managerComment) && (
              <EvaluationResult evaluationData={evaluationData} />
            )}
            
            {/* 評価履歴 */}
            <EvaluationHistory historyData={historyData} />
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>評価データがありません</div>
        )}
      </div>
      
      <footer className="footer">
        <p>&copy; 2025 人事システム All Rights Reserved.</p>
      </footer>
    </div>
  );
};

export default Kouka;
```

### 11. App.tsx

```tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import Login from './components/Login';
import Main from './components/Main';
import Kintai from './components/Kintai';
import Kyuyo from './components/Kyuyo';
import Kouka from './components/Kouka';

// 認証が必要なルートのラッパーコンポーネント
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/main" element={
        <ProtectedRoute>
          <Main />
        </ProtectedRoute>
      } />
      <Route path="/kintai" element={
        <ProtectedRoute>
          <Kintai />
        </ProtectedRoute>
      } />
      <Route path="/kyuyo" element={
        <ProtectedRoute>
          <Kyuyo />
        </ProtectedRoute>
      } />
      <Route path="/kouka" element={
        <ProtectedRoute>
          <Kouka />
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
};

export default App;
```

### 12. index.tsx

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 13. public/index.html

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="人事システム"
    />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
    <title>人事システム</title>
  </head>
  <body>
    <noscript>このアプリケーションを実行するにはJavaScriptを有効にしてください。</noscript>
    <div id="root"></div>
  </body>
</html>
```

### 14. package.json (フロントエンド)

```json
{
  "name": "jinji_front",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@types/node": "^16.18.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.10.0",
    "react-scripts": "5.0.1",
    "typescript": "^4.9.5"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
```

### 15. Dockerfile (フロントエンド)

```dockerfile
FROM node:16 as build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 16. docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./jinji_back
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NEON_CONNECT=${NEON_CONNECT}
      - JWT_SECRET=your_jwt_secret_key_here
    restart: always
    networks:
      - jinji-network

  frontend:
    build:
      context: ./jinji_front
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: always
    networks:
      - jinji-network

networks:
  jinji-network:
    driver: bridge
```

## 実行方法

1. 環境変数 `NEON_CONNECT` に PostgreSQL の接続文字列を設定します。
2. `jinji` ディレクトリで以下のコマンドを実行してDockerコンテナを起動します。
   ```
   docker-compose up -d
   ```
3. ブラウザで http://localhost:3000 にアクセスするとログイン画面が表示されます。

## 注意点

実際の運用では以下の点に注意してください：

1. JWT_SECRETは安全な値に変更してください。
2. 本番環境ではHTTPS通信を使用してください。
3. パスワードは実際のシステムではハッシュ化して保存されます。
4. データベースのバックアップを定期的に取得してください。

以上で人事システムの実装が完了しました。仕様に基づいて勤怠管理、給与管理、人事考課の機能を実装しています。
