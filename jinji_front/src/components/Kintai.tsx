import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { getMonthlyAttendance, getDailyAttendance, updateAttendance } from '../api';
import { AttendanceData, AttendanceRecord, LEAVE_TYPES, CalendarDay } from '../types';
import './common.css';

const Kintai: React.FC = () => {
  // 認証情報
  const { employee, token, logout } = useAuth();
  const navigate = useNavigate();
  
  // 状態管理
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [selectedDayData, setSelectedDayData] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // フォーム状態
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [leaveType, setLeaveType] = useState<number>(0);
  
  // 年月の文字列を取得
  const getYearMonthString = (date: Date): string => {
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  
  // 日付の文字列を取得
  const getDateString = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  
  // カレンダーのデータを生成
  const generateCalendar = useCallback((date: Date, data: AttendanceData | null) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // 月の最初の日と最後の日を取得
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 前月の日数を取得して、1日の曜日に合わせて前月のカレンダーを追加
    const prevMonthDays = [];
    const firstDayOfWeek = firstDay.getDay();
    if (firstDayOfWeek > 0) {
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = prevMonthLastDay - firstDayOfWeek + 1; i <= prevMonthLastDay; i++) {
        const dayDate = new Date(year, month - 1, i);
        prevMonthDays.push({
          date: dayDate,
          dateString: getDateString(dayDate),
          isCurrentMonth: false,
          isToday: false
        });
      }
    }
    
    // 当月のカレンダーを追加
    const currentMonthDays = [];
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const dayDate = new Date(year, month, i);
      const dateString = getDateString(dayDate);
      const today = new Date();
      
      const day: CalendarDay = {
        date: dayDate,
        dateString,
        isCurrentMonth: true,
        isToday: dayDate.getDate() === today.getDate() && 
                 dayDate.getMonth() === today.getMonth() && 
                 dayDate.getFullYear() === today.getFullYear()
      };
      
      // 勤怠データがある場合は関連付け
      if (data) {
        const attendance = data.attendances.find(a => a.date === dateString);
        const leave = data.leaves.find(l => l.date === dateString);
        
        if (attendance) {
          day.attendance = attendance;
        }
        
        if (leave) {
          day.leave = leave;
        }
      }
      
      currentMonthDays.push(day);
    }
    
    // 次月の日数を取得して、最終日の曜日に合わせて次月のカレンダーを追加
    const nextMonthDays = [];
    const lastDayOfWeek = lastDay.getDay();
    if (lastDayOfWeek < 6) {
      for (let i = 1; i <= 6 - lastDayOfWeek; i++) {
        const dayDate = new Date(year, month + 1, i);
        nextMonthDays.push({
          date: dayDate,
          dateString: getDateString(dayDate),
          isCurrentMonth: false,
          isToday: false
        });
      }
    }
    
    // 全てのカレンダーデータを結合
    setCalendarDays([...prevMonthDays, ...currentMonthDays, ...nextMonthDays]);
  }, []);
  
  // 月の勤怠データを取得
  const fetchMonthlyAttendance = useCallback(async () => {
    if (!employee || !token) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const yearMonth = getYearMonthString(currentDate);
      const result = await getMonthlyAttendance(employee.id, yearMonth, token);
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
      if (result.data) {
        setAttendanceData(result.data);
        generateCalendar(currentDate, result.data);
      }
    } catch (err) {
      setError('勤怠データの取得中にエラーが発生しました');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [employee, token, currentDate, generateCalendar]);
  
  // 日別の勤怠データを取得
  const fetchDailyAttendance = useCallback(async (date: Date) => {
    if (!employee || !token) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const dateStr = getDateString(date);
      const result = await getDailyAttendance(employee.id, dateStr, token);
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
      if (result.data) {
        setSelectedDayData(result.data);
        setStartTime(result.data.startTime || '');
        setEndTime(result.data.endTime || '');
        setLeaveType(result.data.leaveType || 0);
      } else {
        // データがない場合は初期化
        setSelectedDayData({
          employeeId: employee.id,
          date: dateStr
        });
        setStartTime('');
        setEndTime('');
        setLeaveType(0);
      }
    } catch (err) {
      setError('勤怠データの取得中にエラーが発生しました');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [employee, token]);
  
  // 日付選択ハンドラ
  const handleDayClick = (day: CalendarDay) => {
    setSelectedDate(day.date);
    fetchDailyAttendance(day.date);
  };
  
  // 勤怠データ更新処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !token || !selectedDayData) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // 休暇タイプが選択されている場合と出退勤時間が入力されている場合で処理を分ける
      let attendanceRecord: AttendanceRecord = {
        ...selectedDayData
      };
      
      if (leaveType > 0) {
        // 休暇の場合
        attendanceRecord.leaveType = leaveType;
        attendanceRecord.startTime = undefined;
        attendanceRecord.endTime = undefined;
      } else {
        // 通常勤怠の場合
        attendanceRecord.startTime = startTime || undefined;
        attendanceRecord.endTime = endTime || undefined;
        attendanceRecord.leaveType = undefined;
      }
      
      const result = await updateAttendance(attendanceRecord, token);
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
      setSuccess('勤怠情報を更新しました');
      
      // 勤怠データを再取得
      await fetchMonthlyAttendance();
      await fetchDailyAttendance(selectedDate);
    } catch (err) {
      setError('勤怠データの更新中にエラーが発生しました');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 前月へ移動
  const goToPreviousMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(newDate);
  };
  
  // 次月へ移動
  const goToNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(newDate);
  };
  
  // ログアウト処理
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  // 初期データ取得
  useEffect(() => {
    if (!employee || !token) {
      navigate('/');
      return;
    }
    
    fetchMonthlyAttendance();
    fetchDailyAttendance(selectedDate);
  }, [employee, token, navigate, fetchMonthlyAttendance, fetchDailyAttendance, selectedDate]);
  
  // 月変更時のデータ再取得
  useEffect(() => {
    if (fetchMonthlyAttendance) {
      fetchMonthlyAttendance();
    }
  }, [currentDate, fetchMonthlyAttendance]);
  
  // ヘッダー部分
  const renderHeader = () => (
    <div className="header">
      <h1>勤怠管理</h1>
      <div className="user-info">
        <span>{employee?.name} ({employee?.id})</span>
        <button onClick={() => navigate('/main')}>メニューへ戻る</button>
        <button className="secondary" onClick={handleLogout}>ログアウト</button>
      </div>
    </div>
  );
  
  // カレンダー部分
  const renderCalendar = () => (
    <div className="calendar">
      <div className="calendar-header">
        <button onClick={goToPreviousMonth}>&lt; 前月</button>
        <h2>{currentDate.getFullYear()}年{currentDate.getMonth() + 1}月</h2>
        <button onClick={goToNextMonth}>次月 &gt;</button>
      </div>
      
      <div className="calendar-grid">
        {/* 曜日ヘッダー */}
        {['日', '月', '火', '水', '木', '金', '土'].map(day => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}
        
        {/* カレンダー日付 */}
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`calendar-day ${!day.isCurrentMonth ? 'not-current-month' : ''} ${
              day.isToday ? 'today' : ''
            } ${day.dateString === getDateString(selectedDate) ? 'selected' : ''}`}
            onClick={() => handleDayClick(day)}
          >
            <div className="calendar-day-number">{day.date.getDate()}</div>
            <div className="calendar-day-content">
              {day.attendance && (
                <div style={{ fontSize: '10px' }}>
                  {day.attendance.startTime && day.attendance.startTime.substring(0, 5)}
                  {day.attendance.endTime && ` - ${day.attendance.endTime.substring(0, 5)}`}
                </div>
              )}
              {day.leave && (
                <div style={{ 
                  fontSize: '10px', 
                  color: 'white',
                  backgroundColor: '#ff9800',
                  padding: '2px 4px',
                  borderRadius: '2px'
                }}>
                  {LEAVE_TYPES[day.leave.leaveType as keyof typeof LEAVE_TYPES]}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  
  // 勤怠情報入力フォーム部分
  const renderAttendanceForm = () => {
    const formattedDate = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日(${
      ['日', '月', '火', '水', '木', '金', '土'][selectedDate.getDay()]
    })`;
    
    return (
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
        <h3>勤怠情報入力 - {formattedDate}</h3>
        
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>勤怠タイプ</label>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label>
                <input
                  type="radio"
                  name="attendanceType"
                  checked={leaveType === 0}
                  onChange={() => setLeaveType(0)}
                />
                出勤
              </label>
              <label>
                <input
                  type="radio"
                  name="attendanceType"
                  checked={leaveType > 0}
                  onChange={() => setLeaveType(1)} // デフォルトは年次有給
                />
                休暇
              </label>
            </div>
          </div>
          
          {leaveType === 0 ? (
            <>
              <div className="form-group">
                <label htmlFor="startTime">出勤時間</label>
                <input
                  type="time"
                  id="startTime"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="endTime">退勤時間</label>
                <input
                  type="time"
                  id="endTime"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label htmlFor="leaveType">休暇タイプ</label>
              <select
                id="leaveType"
                value={leaveType}
                onChange={(e) => setLeaveType(parseInt(e.target.value, 10))}
              >
                {Object.entries(LEAVE_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="submit" disabled={isLoading}>
              {isLoading ? '処理中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    );
  };
  
  // 休暇一覧部分
  const renderLeaveList = () => {
    if (!attendanceData || !attendanceData.leaves || attendanceData.leaves.length === 0) {
      return (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
          <h3>休暇一覧</h3>
          <p>当月の休暇はありません。</p>
        </div>
      );
    }
    
    return (
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
        <h3>休暇一覧</h3>
        <table>
          <thead>
            <tr>
              <th>日付</th>
              <th>種類</th>
            </tr>
          </thead>
          <tbody>
            {attendanceData.leaves.map((leave, index) => {
              const leaveDate = new Date(leave.date);
              return (
                <tr key={index}>
                  <td>
                    {`${leaveDate.getMonth() + 1}月${leaveDate.getDate()}日(${
                      ['日', '月', '火', '水', '木', '金', '土'][leaveDate.getDay()]
                    })`}
                  </td>
                  <td>{LEAVE_TYPES[leave.leaveType as keyof typeof LEAVE_TYPES]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };
  
  // メイン表示部分
  return (
    <div>
      {renderHeader()}
      <div className="container">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          {/* 左側: カレンダー */}
          <div style={{ flex: '1', minWidth: '300px' }}>
            {renderCalendar()}
          </div>
          
          {/* 右側: 勤怠情報フォーム */}
          <div style={{ flex: '1', minWidth: '300px' }}>
            {renderAttendanceForm()}
            {renderLeaveList()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kintai;