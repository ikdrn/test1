package main

import (
  "database/sql"
  "fmt"
  "log"
  "net/http"
  "os"
  "strconv"
  "time"

  "github.com/gin-contrib/cors"
  "github.com/gin-gonic/gin"
  _ "github.com/lib/pq"
  // bcryptは現在使用していないのでコメントアウト
  // "golang.org/x/crypto/bcrypt"
)

// データ構造定義
// 社員情報
type Employee struct {
  ID       int    `json:"id"`
  Password string `json:"password,omitempty"`
  Name     string `json:"name"`
  IsAdmin  bool   `json:"isAdmin"` // 社員番号の先頭が2であれば上司
}

// 認証用リクエスト
type LoginRequest struct {
  ID       int    `json:"id" binding:"required"`
  Password string `json:"password" binding:"required"`
}

// 勤怠情報
type Attendance struct {
  EmployeeID int       `json:"employeeId"`
  Date       string    `json:"date"`
  StartTime  string    `json:"startTime,omitempty"`
  EndTime    string    `json:"endTime,omitempty"`
  LeaveType  int       `json:"leaveType,omitempty"` // 休暇タイプがある場合
}

// 給与情報
type Salary struct {
  EmployeeID         int    `json:"employeeId"`
  Month              string `json:"month"` // YYYYMM形式
  BasicSalary        int    `json:"basicSalary"`
  OvertimePay        int    `json:"overtimePay"`
  HealthInsurance    int    `json:"healthInsurance"`
  NursingInsurance   int    `json:"nursingInsurance"`
  PensionInsurance   int    `json:"pensionInsurance"`
  EmploymentInsurance int   `json:"employmentInsurance"`
  IncomeTax          int    `json:"incomeTax"`
  ResidentTax        int    `json:"residentTax"`
  TotalDeduction     int    `json:"totalDeduction"` // 計算項目
  NetSalary          int    `json:"netSalary"`      // 計算項目
}

// 人事考課情報
type Evaluation struct {
  EmployeeID        int    `json:"employeeId"`
  Month             string `json:"month"`
  EmployeeComment   string `json:"employeeComment,omitempty"`
  SkillScore        *int   `json:"skillScore,omitempty"`
  BehaviorScore     *int   `json:"behaviorScore,omitempty"`
  AttitudeScore     *int   `json:"attitudeScore,omitempty"`
  ManagerComment    string `json:"managerComment,omitempty"`
}

// 休暇タイプのマッピング
var leaveTypeMap = map[int]string{
  1: "年次有給",
  2: "産前",
  3: "産後",
  4: "育児",
  5: "介護",
  6: "子の看護",
  7: "生理",
  8: "母性健康管理",
}

// グローバル変数
var db *sql.DB

// データベース接続確認用ミドルウェア
func checkDBConnection() gin.HandlerFunc {
  return func(c *gin.Context) {
    // DB接続状態を確認
    err := db.Ping()
    if err != nil {
      log.Printf("データベース接続エラー: %v", err)
      c.JSON(http.StatusServiceUnavailable, gin.H{"error": "データベースサーバーへの接続に失敗しました。しばらく経ってから再度お試しください。"})
      c.Abort()
      return
    }
    c.Next()
  }
}

// 汎用データベースエラーハンドラ
func handleDatabaseError(c *gin.Context, err error, message string) {
  if err == sql.ErrNoRows {
    c.JSON(http.StatusNotFound, gin.H{"error": "データが見つかりません"})
  } else {
    log.Printf("データベースエラー [%s]: %v", message, err)
    c.JSON(http.StatusInternalServerError, gin.H{"error": message})
  }
}

// トランザクション実行用ヘルパー関数
func executeWithTransaction(c *gin.Context, callback func(*sql.Tx) error, successMessage string) {
  // トランザクション開始
  tx, err := db.Begin()
  if err != nil {
    log.Printf("トランザクション開始エラー: %v", err)
    c.JSON(http.StatusInternalServerError, gin.H{"error": "データベーストランザクションの開始に失敗しました"})
    return
  }
  
  // 関数終了時に実行されるdefer処理
  defer func() {
    // パニックが発生した場合はトランザクションをロールバック
    if r := recover(); r != nil {
      tx.Rollback()
      log.Printf("トランザクション実行中のパニック: %v", r)
      c.JSON(http.StatusInternalServerError, gin.H{"error": "予期せぬエラーが発生しました"})
    }
  }()
  
  // コールバック関数を実行
  if err := callback(tx); err != nil {
    tx.Rollback() // エラー発生時はロールバック
    if err == sql.ErrNoRows {
      c.JSON(http.StatusNotFound, gin.H{"error": "操作対象のデータが見つかりません"})
    } else {
      log.Printf("トランザクション実行エラー: %v", err)
      c.JSON(http.StatusInternalServerError, gin.H{"error": "データベース操作中にエラーが発生しました"})
    }
    return
  }
  
  // トランザクションコミット
  if err := tx.Commit(); err != nil {
    log.Printf("トランザクションコミットエラー: %v", err)
    c.JSON(http.StatusInternalServerError, gin.H{"error": "データベースへの変更の確定に失敗しました"})
    return
  }
  
  // 成功レスポンス
  c.JSON(http.StatusOK, gin.H{"message": successMessage})
}

func main() {
  // データベース接続
  var err error
  dbConnStr := os.Getenv("NEON_CONNECT")
  if dbConnStr == "" {
    log.Fatal("環境変数 NEON_CONNECT が設定されていません")
  }

  // 接続リトライロジック
  maxRetries := 5
  retryInterval := time.Second * 3
  
  for i := 0; i < maxRetries; i++ {
    log.Printf("データベース接続試行 (%d/%d)", i+1, maxRetries)
    db, err = sql.Open("postgres", dbConnStr)
    if err == nil {
      // 接続テスト
      err = db.Ping()
      if err == nil {
        log.Println("データベース接続成功")
        break
      }
    }
    
    if i < maxRetries-1 {
      log.Printf("データベース接続エラー: %s - %d秒後に再試行します", err, retryInterval/time.Second)
      time.Sleep(retryInterval)
    } else {
      log.Fatalf("データベース接続失敗: %s", err)
    }
  }
  
  // コネクションプール設定
  db.SetMaxOpenConns(25)  // 最大接続数
  db.SetMaxIdleConns(5)   // アイドル状態の最大接続数
  db.SetConnMaxLifetime(5 * time.Minute) // 接続の最大生存期間
  
  defer db.Close()

  // Ginルーター設定
  router := gin.Default()
  
  // エラーハンドリングの改善
  router.Use(gin.Recovery())
  
  // CORS設定
  config := cors.DefaultConfig()
  config.AllowOrigins = []string{"http://localhost:3000"}
  config.AllowCredentials = true
  config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
  router.Use(cors.New(config))

  // ルーティング設定
  // 認証関連
  router.POST("/api/login", handleLogin)
  
  // 認証が必要なエンドポイント
  authorized := router.Group("/api")
  authorized.Use(authMiddleware())
  authorized.Use(checkDBConnection()) // DB接続チェックを追加
  {
    // 社員情報
    authorized.GET("/employee/:id", getEmployee)
    
    // 勤怠関連
    authorized.GET("/attendance/:id", getAttendance)
    authorized.GET("/attendance/:id/:date", getAttendanceByDate)
    authorized.POST("/attendance", createUpdateAttendance)
    authorized.GET("/leave/:id", getLeaves)
    authorized.POST("/leave", createLeave)
    authorized.DELETE("/leave/:id/:date", deleteLeave)
    
    // 給与関連
    authorized.GET("/salary/:id/:month", getSalary)
    authorized.GET("/salary/:id", getSalaries)
    
    // 人事考課関連
    authorized.GET("/evaluation/:id/:month", getEvaluation)
    authorized.GET("/evaluation/:id", getEvaluations)
    authorized.POST("/evaluation", updateEvaluation)
  }

  // サーバー起動
  port := ":8080"
  fmt.Printf("サーバーが%sで起動しました\n", port)
  router.Run(port)
}

// 認証ミドルウェア
func authMiddleware() gin.HandlerFunc {
  return func(c *gin.Context) {
    token := c.GetHeader("Authorization")
    if token == "" {
      c.JSON(http.StatusUnauthorized, gin.H{"error": "認証が必要です"})
      c.Abort()
      return
    }

    // トークン検証ロジック（実践ではJWTなどを使用）
    // ここでは簡易的な実装
    employeeID, err := strconv.Atoi(token)
    if err != nil || employeeID < 10000 {
      c.JSON(http.StatusUnauthorized, gin.H{"error": "無効なトークンです"})
      c.Abort()
      return
    }

    // ユーザー情報をコンテキストに設定
    c.Set("employeeID", employeeID)
    c.Next()
  }
}

// ログイン処理
func handleLogin(c *gin.Context) {
  var req LoginRequest
  if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエスト"})
    return
  }

  var storedPassword string
  var employeeName string
  err := db.QueryRow("SELECT emplps, emplnm FROM TBL_EMPLO WHERE emplid = $1", req.ID).Scan(&storedPassword, &employeeName)
  if err != nil {
    if err == sql.ErrNoRows {
      c.JSON(http.StatusUnauthorized, gin.H{"error": "ユーザーが見つかりません"})
    } else {
      handleDatabaseError(c, err, "ログイン処理中にデータベースエラーが発生しました")
    }
    return
  }

  // 本来はbcryptによるハッシュ比較を行う
  // 仕様に従い、現時点では単純比較を実装
  // 実運用環境ではこの部分をbcryptを使用した安全な実装に変更すべき
  // err = bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(req.Password))
  // if err != nil {
  //   c.JSON(http.StatusUnauthorized, gin.H{"error": "パスワードが一致しません"})
  //   return
  // }
  
  if storedPassword != req.Password {
    c.JSON(http.StatusUnauthorized, gin.H{"error": "パスワードが一致しません"})
    return
  }

  // 管理者権限の判定（社員番号の1桁目が2なら管理者）
  isAdmin := req.ID >= 20000 && req.ID < 30000

  c.JSON(http.StatusOK, gin.H{
    "token": strconv.Itoa(req.ID), // 簡易実装。実際にはJWTなどを使用
    "employee": Employee{
      ID:      req.ID,
      Name:    employeeName,
      IsAdmin: isAdmin,
    },
  })
}

// 社員情報取得
func getEmployee(c *gin.Context) {
  id, err := strconv.Atoi(c.Param("id"))
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なID"})
    return
  }

  var employee Employee
  err = db.QueryRow("SELECT emplid, emplnm FROM TBL_EMPLO WHERE emplid = $1", id).
    Scan(&employee.ID, &employee.Name)
  
  if err != nil {
    handleDatabaseError(c, err, "社員情報の取得に失敗しました")
    return
  }

  // 管理者権限の判定
  employee.IsAdmin = id >= 20000 && id < 30000

  c.JSON(http.StatusOK, employee)
}

// 勤怠情報取得（月別）
func getAttendance(c *gin.Context) {
  id, err := strconv.Atoi(c.Param("id"))
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なID"})
    return
  }

  // クエリパラメータから年月を取得（デフォルトは当月）
  yearMonth := c.DefaultQuery("month", time.Now().Format("200601"))
  
  // 指定された年月の勤怠データを取得
  rows, err := db.Query(`
    SELECT a.atteid, a.attedt, a.attest, a.atteet
    FROM TBL_ATTEN a
    WHERE a.atteid = $1 AND TO_CHAR(a.attedt, 'YYYYMM') = $2
    ORDER BY a.attedt
  `, id, yearMonth)
  
  if err != nil {
    handleDatabaseError(c, err, "勤怠データの取得に失敗しました")
    return
  }
  defer rows.Close()

  var attendances []Attendance
  for rows.Next() {
    var att Attendance
    var startTime, endTime sql.NullString
    err := rows.Scan(&att.EmployeeID, &att.Date, &startTime, &endTime)
    if err != nil {
      c.JSON(http.StatusInternalServerError, gin.H{"error": "データ読み取りエラー"})
      return
    }
    
    if startTime.Valid {
      att.StartTime = startTime.String
    }
    if endTime.Valid {
      att.EndTime = endTime.String
    }
    
    attendances = append(attendances, att)
  }

  // 休暇情報も取得
  leaveRows, err := db.Query(`
    SELECT l.lereid, l.leredt, l.leretp
    FROM TBL_LEAVE l
    WHERE l.lereid = $1 AND TO_CHAR(l.leredt, 'YYYYMM') = $2
    ORDER BY l.leredt
  `, id, yearMonth)
  
  if err != nil {
    handleDatabaseError(c, err, "休暇データの取得に失敗しました")
    return
  }
  defer leaveRows.Close()

  // 休暇情報をマージ
  var leaves []Attendance
  for leaveRows.Next() {
    var leave Attendance
    err := leaveRows.Scan(&leave.EmployeeID, &leave.Date, &leave.LeaveType)
    if err != nil {
      c.JSON(http.StatusInternalServerError, gin.H{"error": "休暇データ読み取りエラー"})
      return
    }
    
    leaves = append(leaves, leave)
  }

  // 応答を返す
  c.JSON(http.StatusOK, gin.H{
    "attendances": attendances,
    "leaves": leaves,
  })
}

// 勤怠情報取得（日別）
func getAttendanceByDate(c *gin.Context) {
  id, err := strconv.Atoi(c.Param("id"))
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なID"})
    return
  }

  date := c.Param("date") // YYYY-MM-DD形式

  // 勤怠データを取得
  var attendance Attendance
  var startTime, endTime sql.NullString
  err = db.QueryRow(`
    SELECT atteid, attedt, attest, atteet
    FROM TBL_ATTEN
    WHERE atteid = $1 AND attedt = $2
  `, id, date).Scan(&attendance.EmployeeID, &attendance.Date, &startTime, &endTime)
  
  if err != nil && err != sql.ErrNoRows {
    handleDatabaseError(c, err, "勤怠データの取得に失敗しました")
    return
  }

  if err == sql.ErrNoRows {
    // レコードがない場合は新規作成に備えて基本情報だけセット
    attendance.EmployeeID = id
    attendance.Date = date
  } else {
    if startTime.Valid {
      attendance.StartTime = startTime.String
    }
    if endTime.Valid {
      attendance.EndTime = endTime.String
    }
  }

  // 休暇情報も確認
  var leaveType sql.NullInt64
  err = db.QueryRow(`
    SELECT leretp
    FROM TBL_LEAVE
    WHERE lereid = $1 AND leredt = $2
  `, id, date).Scan(&leaveType)
  
  if err != nil && err != sql.ErrNoRows {
    handleDatabaseError(c, err, "休暇データの取得に失敗しました")
    return
  }

  if err != sql.ErrNoRows {
    attendance.LeaveType = int(leaveType.Int64)
  }

  // 応答を返す
  c.JSON(http.StatusOK, attendance)
}

// 勤怠情報の登録・更新
func createUpdateAttendance(c *gin.Context) {
  var att Attendance
  if err := c.ShouldBindJSON(&att); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエスト"})
    return
  }

  // 入力データの検証
  if att.EmployeeID <= 0 || att.Date == "" {
    c.JSON(http.StatusBadRequest, gin.H{"error": "従業員IDと日付は必須です"})
    return
  }

  // 勤怠締め日のチェック
  date, err := time.Parse("2006-01-02", att.Date)
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効な日付形式"})
    return
  }

  // 当月の最終日を取得
  currentYear, currentMonth, _ := time.Now().Date()
  lastDayOfMonth := time.Date(currentYear, currentMonth+1, 0, 0, 0, 0, 0, time.Local)
  
  // 翌月の第一金曜日を計算
  firstDayNextMonth := time.Date(currentYear, currentMonth+1, 1, 0, 0, 0, 0, time.Local)
  daysUntilFriday := (5 - int(firstDayNextMonth.Weekday()) + 7) % 7
  if daysUntilFriday == 0 {
    daysUntilFriday = 7
  }
  firstFridayNextMonth := firstDayNextMonth.AddDate(0, 0, daysUntilFriday)
  
  // 締め日チェック（現在の日付が翌月の第一金曜日を過ぎていないかチェック）
  if date.Before(lastDayOfMonth.AddDate(0, -1, 0)) || time.Now().After(firstFridayNextMonth) {
    c.JSON(http.StatusBadRequest, gin.H{"error": "入力期間外の勤怠は更新できません"})
    return
  }

  // トランザクションによる処理実行
  executeWithTransaction(c, func(tx *sql.Tx) error {
    if att.LeaveType > 0 {
      // 休暇情報を登録
      _, err := tx.Exec(`
        INSERT INTO TBL_LEAVE (lereid, leredt, leretp)
        VALUES ($1, $2, $3)
        ON CONFLICT (lereid, leredt) DO UPDATE
        SET leretp = $3
      `, att.EmployeeID, att.Date, att.LeaveType)

      if err != nil {
        return err
      }

      // 関連する勤怠データを削除（休暇と出勤は排他的）
      _, err = tx.Exec(`
        DELETE FROM TBL_ATTEN
        WHERE atteid = $1 AND attedt = $2
      `, att.EmployeeID, att.Date)

      if err != nil {
        return err
      }
    } else {
      // 休暇情報があれば削除
      _, err := tx.Exec(`
        DELETE FROM TBL_LEAVE
        WHERE lereid = $1 AND leredt = $2
      `, att.EmployeeID, att.Date)

      if err != nil {
        return err
      }

      // 勤怠情報を登録・更新
      _, err = tx.Exec(`
        INSERT INTO TBL_ATTEN (atteid, attedt, attest, atteet)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (atteid, attedt) DO UPDATE
        SET attest = $3, atteet = $4
      `, att.EmployeeID, att.Date, att.StartTime, att.EndTime)

      if err != nil {
        return err
      }
    }
    
    return nil
  }, "勤怠情報を更新しました")
}

// 休暇情報取得
func getLeaves(c *gin.Context) {
  id, err := strconv.Atoi(c.Param("id"))
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なID"})
    return
  }

  // クエリパラメータから年月を取得（デフォルトは当月）
  yearMonth := c.DefaultQuery("month", time.Now().Format("200601"))
  
  // 指定された年月の休暇データを取得
  rows, err := db.Query(`
    SELECT lereid, leredt, leretp
    FROM TBL_LEAVE
    WHERE lereid = $1 AND TO_CHAR(leredt, 'YYYYMM') = $2
    ORDER BY leredt
  `, id, yearMonth)
  
  if err != nil {
    handleDatabaseError(c, err, "休暇データの取得に失敗しました")
    return
  }
  defer rows.Close()

  var leaves []Attendance
  for rows.Next() {
    var leave Attendance
    err := rows.Scan(&leave.EmployeeID, &leave.Date, &leave.LeaveType)
    if err != nil {
      c.JSON(http.StatusInternalServerError, gin.H{"error": "データ読み取りエラー"})
      return
    }
    
    leaves = append(leaves, leave)
  }

  c.JSON(http.StatusOK, leaves)
}

// 休暇情報登録
func createLeave(c *gin.Context) {
  var leave Attendance
  if err := c.ShouldBindJSON(&leave); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエスト"})
    return
  }

  // 入力データの検証
  if leave.EmployeeID <= 0 || leave.Date == "" || leave.LeaveType <= 0 {
    c.JSON(http.StatusBadRequest, gin.H{"error": "従業員ID、日付、休暇タイプは必須です"})
    return
  }

  // 休暇情報を登録
  _, err := db.Exec(`
    INSERT INTO TBL_LEAVE (lereid, leredt, leretp)
    VALUES ($1, $2, $3)
    ON CONFLICT (lereid, leredt) DO UPDATE
    SET leretp = $3
  `, leave.EmployeeID, leave.Date, leave.LeaveType)

  if err != nil {
    handleDatabaseError(c, err, "休暇データの登録に失敗しました")
    return
  }

  // 関連する勤怠データがあれば削除（休暇と出勤は排他的）
  _, err = db.Exec(`
    DELETE FROM TBL_ATTEN
    WHERE atteid = $1 AND attedt = $2
  `, leave.EmployeeID, leave.Date)

  if err != nil {
    handleDatabaseError(c, err, "関連勤怠データの削除に失敗しました")
    return
  }

  c.JSON(http.StatusOK, gin.H{"message": "休暇情報を登録しました"})
}

// 休暇情報削除
func deleteLeave(c *gin.Context) {
  id, err := strconv.Atoi(c.Param("id"))
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なID"})
    return
  }

  date := c.Param("date")
  if date == "" {
    c.JSON(http.StatusBadRequest, gin.H{"error": "日付は必須です"})
    return
  }

  // 休暇情報を削除
  result, err := db.Exec(`
    DELETE FROM TBL_LEAVE
    WHERE lereid = $1 AND leredt = $2
  `, id, date)

  if err != nil {
    handleDatabaseError(c, err, "休暇データの削除に失敗しました")
    return
  }

  count, err := result.RowsAffected()
  if err != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "結果取得エラー"})
    return
  }

  if count == 0 {
    c.JSON(http.StatusNotFound, gin.H{"error": "指定された休暇情報が見つかりません"})
    return
  }

  c.JSON(http.StatusOK, gin.H{"message": "休暇情報を削除しました"})
}

// 給与情報取得（月別）
func getSalary(c *gin.Context) {
  id, err := strconv.Atoi(c.Param("id"))
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なID"})
    return
  }

  month := c.Param("month") // YYYYMM形式
  if len(month) != 6 {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効な月形式"})
    return
  }

  var salary Salary
  err = db.QueryRow(`
    SELECT srlyid, srlymt, srlykh, srlyzg, srlyke, srlyka, srlyko, srlyky, srlysy, srlysz
    FROM TBL_SALRY
    WHERE srlyid = $1 AND srlymt = $2
  `, id, month).Scan(
    &salary.EmployeeID, &salary.Month, &salary.BasicSalary, &salary.OvertimePay,
    &salary.HealthInsurance, &salary.NursingInsurance, &salary.PensionInsurance,
    &salary.EmploymentInsurance, &salary.IncomeTax, &salary.ResidentTax,
  )

  if err != nil {
    handleDatabaseError(c, err, "給与データの取得に失敗しました")
    return
  }

  // 控除合計と手取り額を計算
  salary.TotalDeduction = salary.HealthInsurance + salary.NursingInsurance +
    salary.PensionInsurance + salary.EmploymentInsurance +
    salary.IncomeTax + salary.ResidentTax
  salary.NetSalary = salary.BasicSalary + salary.OvertimePay - salary.TotalDeduction

  c.JSON(http.StatusOK, salary)
}

// 給与情報履歴取得
func getSalaries(c *gin.Context) {
  id, err := strconv.Atoi(c.Param("id"))
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なID"})
    return
  }

  // 給与データ取得（直近12ヶ月分）
  rows, err := db.Query(`
    SELECT srlyid, srlymt, srlykh, srlyzg, srlyke, srlyka, srlyko, srlyky, srlysy, srlysz
    FROM TBL_SALRY
    WHERE srlyid = $1
    ORDER BY srlymt DESC
    LIMIT 12
  `, id)
  
  if err != nil {
    handleDatabaseError(c, err, "給与データの取得に失敗しました")
    return
  }
  defer rows.Close()

  var salaries []Salary
  for rows.Next() {
    var salary Salary
    err := rows.Scan(
      &salary.EmployeeID, &salary.Month, &salary.BasicSalary, &salary.OvertimePay,
      &salary.HealthInsurance, &salary.NursingInsurance, &salary.PensionInsurance,
      &salary.EmploymentInsurance, &salary.IncomeTax, &salary.ResidentTax,
    )
    if err != nil {
      c.JSON(http.StatusInternalServerError, gin.H{"error": "データ読み取りエラー"})
      return
    }
    
    // 控除合計と手取り額を計算
    salary.TotalDeduction = salary.HealthInsurance + salary.NursingInsurance +
      salary.PensionInsurance + salary.EmploymentInsurance +
      salary.IncomeTax + salary.ResidentTax
    salary.NetSalary = salary.BasicSalary + salary.OvertimePay - salary.TotalDeduction
    
    salaries = append(salaries, salary)
  }

  c.JSON(http.StatusOK, salaries)
}

// 人事考課情報取得（月別）
func getEvaluation(c *gin.Context) {
  id, err := strconv.Atoi(c.Param("id"))
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なID"})
    return
  }

  month := c.Param("month") // YYYYMM形式
  if len(month) != 6 {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効な月形式"})
    return
  }

  var eval Evaluation
  var skillScore, behaviorScore, attitudeScore sql.NullInt64
  err = db.QueryRow(`
    SELECT kokaid, kokamt, kokabk, kokazg, kokake, kokaty, kokajs
    FROM TBL_KOUKA
    WHERE kokaid = $1 AND kokamt = $2
  `, id, month).Scan(
    &eval.EmployeeID, &eval.Month, &eval.EmployeeComment,
    &skillScore, &behaviorScore, &attitudeScore, &eval.ManagerComment,
  )

  if err != nil {
    if err == sql.ErrNoRows {
      // レコードがない場合は新規作成に備えて基本情報だけセット
      eval.EmployeeID = id
      eval.Month = month
    } else {
      handleDatabaseError(c, err, "人事考課データの取得に失敗しました")
      return
    }
  } else {
    // Null値の処理
    if skillScore.Valid {
      score := int(skillScore.Int64)
      eval.SkillScore = &score
    }
    if behaviorScore.Valid {
      score := int(behaviorScore.Int64)
      eval.BehaviorScore = &score
    }
    if attitudeScore.Valid {
      score := int(attitudeScore.Int64)
      eval.AttitudeScore = &score
    }
  }

  // 前月のデータも取得（存在する場合）
  var previousMonth string
  year, _ := strconv.Atoi(month[:4])
  m, _ := strconv.Atoi(month[4:])
  
  if m == 1 {
    previousMonth = fmt.Sprintf("%d%02d", year-1, 12)
  } else {
    previousMonth = fmt.Sprintf("%d%02d", year, m-1)
  }
  
  var prevEval Evaluation
  var prevSkillScore, prevBehaviorScore, prevAttitudeScore sql.NullInt64
  err = db.QueryRow(`
    SELECT kokaid, kokamt, kokabk, kokazg, kokake, kokaty, kokajs
    FROM TBL_KOUKA
    WHERE kokaid = $1 AND kokamt = $2
  `, id, previousMonth).Scan(
    &prevEval.EmployeeID, &prevEval.Month, &prevEval.EmployeeComment,
    &prevSkillScore, &prevBehaviorScore, &prevAttitudeScore, &prevEval.ManagerComment,
  )

  // エラーを無視（前月のデータがない場合もあるため）
  if err == nil {
    // Null値の処理
    if prevSkillScore.Valid {
      score := int(prevSkillScore.Int64)
      prevEval.SkillScore = &score
    }
    if prevBehaviorScore.Valid {
      score := int(prevBehaviorScore.Int64)
      prevEval.BehaviorScore = &score
    }
    if prevAttitudeScore.Valid {
      score := int(prevAttitudeScore.Int64)
      prevEval.AttitudeScore = &score
    }
  }

  c.JSON(http.StatusOK, gin.H{
    "current": eval,
    "previous": prevEval,
  })
}

// 人事考課情報履歴取得
func getEvaluations(c *gin.Context) {
  id, err := strconv.Atoi(c.Param("id"))
  if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なID"})
    return
  }

  // 人事考課データ取得（直近12ヶ月分）
  rows, err := db.Query(`
    SELECT kokaid, kokamt, kokabk, kokazg, kokake, kokaty, kokajs
    FROM TBL_KOUKA
    WHERE kokaid = $1
    ORDER BY kokamt DESC
    LIMIT 12
  `, id)
  
  if err != nil {
    handleDatabaseError(c, err, "人事考課データの取得に失敗しました")
    return
  }
  defer rows.Close()

  var evaluations []Evaluation
  for rows.Next() {
    var eval Evaluation
    var skillScore, behaviorScore, attitudeScore sql.NullInt64
    err := rows.Scan(
      &eval.EmployeeID, &eval.Month, &eval.EmployeeComment,
      &skillScore, &behaviorScore, &attitudeScore, &eval.ManagerComment,
    )
    if err != nil {
      c.JSON(http.StatusInternalServerError, gin.H{"error": "データ読み取りエラー"})
      return
    }
    
    // Null値の処理
    if skillScore.Valid {
      score := int(skillScore.Int64)
      eval.SkillScore = &score
    }
    if behaviorScore.Valid {
      score := int(behaviorScore.Int64)
      eval.BehaviorScore = &score
    }
    if attitudeScore.Valid {
      score := int(attitudeScore.Int64)
      eval.AttitudeScore = &score
    }
    
    evaluations = append(evaluations, eval)
  }

  c.JSON(http.StatusOK, evaluations)
}

// 人事考課情報更新
func updateEvaluation(c *gin.Context) {
  var eval Evaluation
  if err := c.ShouldBindJSON(&eval); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "無効なリクエスト"})
    return
  }

  // 入力データの検証
  if eval.EmployeeID <= 0 || eval.Month == "" {
    c.JSON(http.StatusBadRequest, gin.H{"error": "従業員IDと月は必須です"})
    return
  }

  // ユーザー権限チェック
  userID, exists := c.Get("employeeID")
  if !exists {
    c.JSON(http.StatusUnauthorized, gin.H{"error": "認証情報がありません"})
    return
  }

  // 上司権限の場合は全フィールド更新可、一般社員は自分のコメントのみ更新可
  isAdmin := userID.(int) >= 20000 && userID.(int) < 30000
  
  if !isAdmin && userID.(int) != eval.EmployeeID {
    c.JSON(http.StatusForbidden, gin.H{"error": "他の社員の考課を更新する権限がありません"})
    return
  }

  // トランザクションによる処理実行
  executeWithTransaction(c, func(tx *sql.Tx) error {
    // 既存データの取得
    var existingEval Evaluation
    var skillScore, behaviorScore, attitudeScore sql.NullInt64
    var employeeComment, managerComment sql.NullString
    
    err := tx.QueryRow(`
      SELECT kokaid, kokamt, kokabk, kokazg, kokake, kokaty, kokajs
      FROM TBL_KOUKA
      WHERE kokaid = $1 AND kokamt = $2
    `, eval.EmployeeID, eval.Month).Scan(
      &existingEval.EmployeeID, &existingEval.Month, &employeeComment,
      &skillScore, &behaviorScore, &attitudeScore, &managerComment,
    )

    // 更新処理の準備
    var employeeCommentValue sql.NullString
    var skillScoreValue, behaviorScoreValue, attitudeScoreValue sql.NullInt64
    var managerCommentValue sql.NullString

    // 新規評価のコメントをNullStringに変換
    if eval.EmployeeComment != "" {
      employeeCommentValue = sql.NullString{String: eval.EmployeeComment, Valid: true}
    }
    
    if isAdmin {
      // 上司の場合は評価スコアと上司コメントも設定
      if eval.SkillScore != nil {
        skillScoreValue = sql.NullInt64{Int64: int64(*eval.SkillScore), Valid: true}
      }
      if eval.BehaviorScore != nil {
        behaviorScoreValue = sql.NullInt64{Int64: int64(*eval.BehaviorScore), Valid: true}
      }
      if eval.AttitudeScore != nil {
        attitudeScoreValue = sql.NullInt64{Int64: int64(*eval.AttitudeScore), Valid: true}
      }
      if eval.ManagerComment != "" {
        managerCommentValue = sql.NullString{String: eval.ManagerComment, Valid: true}
      }
    }

    if err == nil {
      // 既存データがある場合は更新
      // 一般社員の場合は自分のコメントのみ更新
      if !isAdmin {
        skillScoreValue = skillScore
        behaviorScoreValue = behaviorScore
        attitudeScoreValue = attitudeScore
        managerCommentValue = managerComment
      }
      
      _, err = tx.Exec(`
        UPDATE TBL_KOUKA
        SET kokabk = $3, kokazg = $4, kokake = $5, kokaty = $6, kokajs = $7
        WHERE kokaid = $1 AND kokamt = $2
      `, eval.EmployeeID, eval.Month, employeeCommentValue,
         skillScoreValue, behaviorScoreValue, attitudeScoreValue, managerCommentValue)
      
      if err != nil {
        return err
      }
    } else if err == sql.ErrNoRows {
      // 新規データ作成
      if !isAdmin {
        // 一般社員は自分のコメントのみ設定可能
        _, err = tx.Exec(`
          INSERT INTO TBL_KOUKA (kokaid, kokamt, kokabk)
          VALUES ($1, $2, $3)
        `, eval.EmployeeID, eval.Month, employeeCommentValue)
      } else {
        // 上司は全項目を設定可能
        _, err = tx.Exec(`
          INSERT INTO TBL_KOUKA (kokaid, kokamt, kokabk, kokazg, kokake, kokaty, kokajs)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, eval.EmployeeID, eval.Month, employeeCommentValue,
           skillScoreValue, behaviorScoreValue, attitudeScoreValue, managerCommentValue)
      }
      
      if err != nil {
        return err
      }
    } else {
      // その他のデータベースエラー
      return err
    }
    
    return nil
  }, "人事考課情報を更新しました")
}

// 給与計算関数（勤怠データから給与計算を行う）
func calculateSalary(employeeID int, yearMonth string) error {
  // 基本情報の取得
  var basicSalary int
  err := db.QueryRow(`
    SELECT srlykh 
    FROM TBL_SALRY 
    WHERE srlyid = $1 
    ORDER BY srlymt DESC 
    LIMIT 1
  `, employeeID).Scan(&basicSalary)
  
  if err != nil && err != sql.ErrNoRows {
    return err
  }
  
  // 初回の場合はデフォルト給与を設定
  if err == sql.ErrNoRows {
    basicSalary = 250000 // デフォルト基本給
  }
  
  // 勤怠データから残業時間を集計
  var overtimeMinutes int
  err = db.QueryRow(`
    SELECT COALESCE(SUM(
      EXTRACT(EPOCH FROM (atteet - '18:00:00'::time))/60
    ), 0)
    FROM TBL_ATTEN
    WHERE atteid = $1 
    AND TO_CHAR(attedt, 'YYYYMM') = $2
    AND atteet > '18:00:00'::time
  `, employeeID, yearMonth).Scan(&overtimeMinutes)
  
  if err != nil {
    return err
  }
  
  // 残業手当計算（時給2000円と仮定）
  overtimePay := (overtimeMinutes / 60) * 2000
  
  // 社会保険料計算
  yearlyIncome := basicSalary * 12
  healthInsurance := int(float64(basicSalary) * 0.05)    // 健康保険料: 5%
  nursingInsurance := int(float64(basicSalary) * 0.018)  // 介護保険料: 1.8%
  pensionInsurance := int(float64(basicSalary) * 0.0915) // 厚生年金: 9.15%
  employmentInsurance := int(float64(basicSalary) * 0.005) // 雇用保険: 0.5%
  
  // 所得税計算（累進課税）
  var incomeTaxRate float64
  if yearlyIncome <= 1950000 {
    incomeTaxRate = 0.05
  } else if yearlyIncome <= 3300000 {
    incomeTaxRate = 0.10
  } else if yearlyIncome <= 6950000 {
    incomeTaxRate = 0.20
  } else if yearlyIncome <= 9000000 {
    incomeTaxRate = 0.23
  } else if yearlyIncome <= 18000000 {
    incomeTaxRate = 0.33
  } else if yearlyIncome <= 40000000 {
    incomeTaxRate = 0.40
  } else {
    incomeTaxRate = 0.45
  }
  
  incomeTax := int(float64(basicSalary) * incomeTaxRate)
  
  // 住民税計算（10%と仮定）
  residentTax := int(float64(basicSalary) * 0.10)
  
  // 給与テーブルに登録
  _, err = db.Exec(`
    INSERT INTO TBL_SALRY (
      srlyid, srlymt, srlykh, srlyzg, srlyke, srlyka, srlyko, srlyky, srlysy, srlysz
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
    ) ON CONFLICT (srlyid, srlymt) DO UPDATE SET
      srlykh = $3, srlyzg = $4, srlyke = $5, srlyka = $6, 
      srlyko = $7, srlyky = $8, srlysy = $9, srlysz = $10
  `, 
    employeeID, yearMonth, basicSalary, overtimePay, 
    healthInsurance, nursingInsurance, pensionInsurance, 
    employmentInsurance, incomeTax, residentTax)
  
  return err
}