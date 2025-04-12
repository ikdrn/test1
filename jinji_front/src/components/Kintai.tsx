import React, { useState } from 'react';
import './common.css';

const Kintai: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    // 選択日付の勤怠データをAPI経由で取得する処理を検討
  };

  const handleSave = async () => {
    // 出退勤情報の更新API呼び出し（例：PUT /attendance）
    // payload例: { emplid: ログイン中の社員番号, date: "YYYY-MM-DD", start_time, end_time }
  };

  // シンプルなカレンダー例：本日から7日間
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d);
  }

  return (
    <div className="kintai-container">
      <div className="calendar">
        <h3>カレンダー</h3>
        <ul>
          {dates.map((date, idx) => (
            <li
              key={idx}
              onClick={() => handleDateClick(date)}
              className={
                date.toDateString() === selectedDate.toDateString()
                  ? 'selected'
                  : ''
              }
            >
              {date.toDateString()}
            </li>
          ))}
        </ul>
      </div>
      <div className="attendance-form">
        <h3>{selectedDate.toDateString()}の勤怠</h3>
        <div>
          <label>出勤時間:</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div>
          <label>退勤時間:</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
        <button onClick={handleSave}>保存</button>
      </div>
    </div>
  );
};

export default Kintai;