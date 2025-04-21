import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import './common.css';

const Main: React.FC = () => {
  const { employee, logout } = useAuth();
  const navigate = useNavigate();
  
  // 各画面への遷移ハンドラー
  const navigateTo = (path: string) => {
    navigate(path);
  };
  
  // ログアウト処理
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  // 画面上部（ヘッダー）
  const renderHeader = () => (
    <div className="header">
      <h1>人事システム</h1>
      <div className="user-info">
        <span>{employee?.name} ({employee?.id})</span>
        <span style={{
          backgroundColor: employee?.isAdmin ? '#2c3e50' : '#3498db',
          color: 'white',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '0.9rem'
        }}>
          {employee?.isAdmin ? '管理者' : '一般'}
        </span>
        <button className="secondary" onClick={handleLogout}>ログアウト</button>
      </div>
    </div>
  );
  
  // メニューカード
  const renderMenuCards = () => (
    <div className="card-container">
      <div className="card" onClick={() => navigateTo('/kintai')}>
        <div className="card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3498db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <path d="M8 14h.01"></path>
            <path d="M12 14h.01"></path>
            <path d="M16 14h.01"></path>
            <path d="M8 18h.01"></path>
            <path d="M12 18h.01"></path>
            <path d="M16 18h.01"></path>
          </svg>
        </div>
        <h2>勤怠管理</h2>
        <p>出退勤の記録や休暇申請を行います。カレンダーで月単位の勤怠状況を確認できます。</p>
        <div className="card-footer">
          <button onClick={(e) => {
            e.stopPropagation();
            navigateTo('/kintai');
          }}>開く</button>
        </div>
      </div>
      
      <div className="card" onClick={() => navigateTo('/kyuyo')}>
        <div className="card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3498db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
        <h2>給与確認</h2>
        <p>毎月の給与明細を確認できます。基本給や各種手当、控除項目を確認できます。</p>
        <div className="card-footer">
          <button onClick={(e) => {
            e.stopPropagation();
            navigateTo('/kyuyo');
          }}>開く</button>
        </div>
      </div>
      
      <div className="card" onClick={() => navigateTo('/kouka')}>
        <div className="card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3498db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <h2>人事考課</h2>
        <p>業績評価や自己評価を行います。{employee?.isAdmin ? '部下の評価も行えます。' : '上司からのフィードバックも確認できます。'}</p>
        <div className="card-footer">
          <button onClick={(e) => {
            e.stopPropagation();
            navigateTo('/kouka');
          }}>開く</button>
        </div>
      </div>
    </div>
  );

  // 現在日時を表示
  const renderCurrentDate = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit'
    };
    return (
      <div style={{ 
        textAlign: 'center', 
        margin: '20px 0',
        padding: '10px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        fontSize: '1.1rem'
      }}>
        {now.toLocaleDateString('ja-JP', options)}
      </div>
    );
  };
  
  return (
    <div>
      {renderHeader()}
      <div className="container">
        {renderCurrentDate()}
        <h2 style={{ textAlign: 'center', margin: '30px 0' }}>メインメニュー</h2>
        {renderMenuCards()}
      </div>
    </div>
  );
};

export default Main;