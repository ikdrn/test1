package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

// Employee holds employee data.
type Employee struct {
	EmplID int    `json:"emplid"`
	EmplPS string `json:"emplps"`
	EmplNM string `json:"emplnm"`
}

// LoginPayload is the payload for login.
type LoginPayload struct {
	EmplID   int    `json:"emplid"`
	Password string `json:"password"`
}

func main() {
	// DB接続設定 (環境変数NEON_CONNECTから取得)
	connStr := os.Getenv("NEON_CONNECT")
	if connStr == "" {
		log.Fatal("NEON_CONNECT環境変数が設定されていません")
	}
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// DB接続確認
	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}

	router := gin.Default()

	// ログインエンドポイント
	router.POST("/login", func(c *gin.Context) {
		var login LoginPayload
		if err := c.ShouldBindJSON(&login); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "入力が不正です"})
			return
		}
		var storedHash, emplnm string
		err := db.QueryRow("SELECT emplps, emplnm FROM TBL_EMPLO WHERE emplid=$1", login.EmplID).Scan(&storedHash, &emplnm)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "認証に失敗しました"})
			return
		}
		// ※ 本来はbcryptによるハッシュ比較を行うこと
		if login.Password != storedHash {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "認証に失敗しました"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ログイン成功", "name": emplnm})
	})

	// 勤怠エンドポイント：勤怠を登録または更新する
	router.PUT("/attendance", func(c *gin.Context) {
		type AttendancePayload struct {
			EmplID    int    `json:"emplid"`
			Date      string `json:"date"`       // フォーマット: YYYY-MM-DD
			StartTime string `json:"start_time"` // 出勤時間
			EndTime   string `json:"end_time"`   // 退勤時間（NULL可）
		}
		var payload AttendancePayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "入力が不正です"})
			return
		}
		// PostgreSQLのUPSERT文を利用
		query := `
    INSERT INTO TBL_ATTEN (atteid, attedt, attest, atteet)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (atteid, attedt) DO UPDATE SET 
      attest = EXCLUDED.testt,
      atteet = EXCLUDED.atteet;
    `
		_, err := db.Exec(query, payload.EmplID, payload.Date, payload.StartTime, payload.EndTime)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "勤怠更新に失敗しました"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "勤怠更新完了"})
	})

	// 給与エンドポイント：指定月の給与情報を取得
	router.GET("/salary/:emplid", func(c *gin.Context) {
		emplid := c.Param("emplid")
		month := c.Query("month")
		if month == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "monthパラメータ(YYYYMM形式)は必須です"})
			return
		}
		type Salary struct {
			SrlyKH int `json:"basic_salary"`
			SrlyZG int `json:"overtime_allowance"`
			SrlyKE int `json:"health_insurance"`
			SrlyKA int `json:"nursing_care_insurance"`
			SrlyKO int `json:"pension"`
			SrlyKY int `json:"employment_insurance"`
			SrlySY int `json:"income_tax"`
			SrlySZ int `json:"resident_tax"`
		}
		var salary Salary
		query := `
    SELECT srlykh, srlyzg, srlyke, srlyka, srlyko, srlyky, srlysy, srlysz 
    FROM TBL_SALRY 
    WHERE srlyid=$1 AND srlymt=$2
    `
		err := db.QueryRow(query, emplid, month).Scan(&salary.SrlyKH, &salary.SrlyZG, &salary.SrlyKE, &salary.SrlyKA,
			&salary.SrlyKO, &salary.SrlyKY, &salary.SrlySY, &salary.SrlySZ)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "給与情報が見つかりません"})
			return
		}
		// 控除額の計算
		totalDeductions := salary.SrlyKE + salary.SrlyKA + salary.SrlyKO + salary.SrlyKY + salary.SrlySY + salary.SrlySZ
		takeHome := salary.SrlyKH + salary.SrlyZG - totalDeductions
		c.JSON(http.StatusOK, gin.H{
			"salary":           salary,
			"total_deductions": totalDeductions,
			"take_home":        takeHome,
		})
	})

	// 人事考課エンドポイント：上司・部下からの評価を登録
	router.POST("/performance", func(c *gin.Context) {
		type PerformancePayload struct {
			EmplID            int    `json:"emplid"`
			Month             string `json:"month"` // YYYYMM
			SubordinateInput  string `json:"subordinate_input,omitempty"`
			SupervisorAbility int    `json:"supervisor_ability,omitempty"` // 1〜5
			SupervisorBehavior int   `json:"supervisor_behavior,omitempty"`
			SupervisorAttitude int   `json:"supervisor_attitude,omitempty"`
			SupervisorInput   string `json:"supervisor_input,omitempty"`
		}
		var payload PerformancePayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "入力が不正です"})
			return
		}
		query := `
    INSERT INTO TBL_KOUKA (kokaid, kokamt, kokabk, kokazg, kokake, kokaty, kokajs)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (kokaid, kokamt) DO UPDATE SET 
      kokabk = EXCLUDED.kokabk,
      kokazg = EXCLUDED.kokazg,
      kokake = EXCLUDED.kokake,
      kokaty = EXCLUDED.kokaty,
      kokajs = EXCLUDED.kokajs;
    `
		_, err := db.Exec(query, payload.EmplID, payload.Month, payload.SubordinateInput,
			payload.SupervisorAbility, payload.SupervisorBehavior, payload.SupervisorAttitude, payload.SupervisorInput)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "人事考課の登録に失敗しました"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "人事考課の登録完了"})
	})

	// サーバー起動設定
	srv := &http.Server{
		Addr:           ":8080",
		Handler:        router,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	log.Fatal(srv.ListenAndServe())
}