import React, { useState } from "react";
import "../components/common.css";

// カレンダーと勤怠入力フォームを含むコンポーネント例
const Kintai: React.FC = () => {
  // 日付選択状態と入力フォームの状態を管理（サンプル）
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [attest, setAttest] = useState<string>("");
  const [atteet, setAtteet] = useState<string>("");

  // カレンダーの日付クリック処理
  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    // 選択日付に応じた勤怠データの取得処理を追加可能
  };

  // カレンダー表示のための簡易レンダリング例（ライブラリ非使用）
  const renderCalendar = () => {
    // 今月の1日～末日を生成（簡易例）
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    // 月末日を計算
    const lastDate = new Date(year, month + 1, 0).getDate();
    const dates = [];
    for (let i = 1; i <= lastDate; i++) {
      const dt = new Date(year, month, i);
      const dtStr = dt.toISOString().substring(0, 10);
      dates.push(
        <div
          key={dtStr}
          style={{
            padding: "5px",
            border: dtStr === selectedDate ? "2px solid blue" : "1px solid #ccc",
            margin: "2px",
            fontSize: "0.9em"
          }}
          onClick={() => handleDateClick(dtStr)}
        >
          {i}
        </div>
      );
    }
    return <div style={{ display: "flex", flexWrap: "wrap", width: "200px" }}>{dates}</div>;
  };

  // フォーム送信時にバックエンドへ勤怠データを送るなどの処理を実装可能
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // API通信で勤怠データ送信（例：POST /kintai）
    // 休暇情報の管理表示も必要に応じ実装
    console.log("勤怠データ送信", { selectedDate, attest, atteet });
  };

  return (
    <div className="container">
      <h2>勤怠入力</h2>
      <div style={{ display: "flex", gap: "40px" }}>
        {/* 左側: カレンダー */}
        <div>{renderCalendar()}</div>
        {/* 右側: 出退勤入力フォーム */}
        <div>
          <p>選択日: {selectedDate}</p>
          <form onSubmit={handleSubmit}>
            <div>
              <label>出勤時刻:</label>
              <input type="time" value={attest} onChange={(e) => setAttest(e.target.value)} required />
            </div>
            <div>
              <label>退勤時刻:</label>
              <input type="time" value={atteet} onChange={(e) => setAtteet(e.target.value)} />
            </div>
            <button type="submit">保存</button>
          </form>
        </div>
      </div>
      {/* 休暇一覧やその他詳細表示のエリアを必要に応じ追加 */}
    </div>
  );
};

export default Kintai;
