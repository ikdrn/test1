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
        <span>{employee?.isAdmin ? '管理者' : '一般'}</span>
        <button className="secondary" onClick={handleLogout}>ログアウト</button>
      </div>
    </div>
  );
  
  // メニューカード
  const renderMenuCards = () => (
    <div className="card-container">
      <div className="card" onClick={() => navigateTo('/kintai')}>
        <h2>勤怠管理</h2>
        <p>出退勤の記録や休暇申請を行います。カレンダーで月単位の勤怠状況を確認できます。</p>
      </div>
      
      <div className="card" onClick={() => navigateTo('/kyuyo')}>
        <h2>給与確認</h2>
        <p>毎月の給与明細を確認できます。基本給や各種手当、控除項目を確認できます。</p>
      </div>
      
      <div className="card" onClick={() => navigateTo('/kouka')}>
        <h2>人事考課</h2>
        <p>業績評価や自己評価を行います。{employee?.isAdmin ? '部下の評価も行えます。' : '上司からのフィードバックも確認できます。'}</p>
      </div>
    </div>
  );
  
  return (
    <div>
      {renderHeader()}
      <div className="container">
        <h2 style={{ textAlign: 'center', margin: '30px 0' }}>メインメニュー</h2>
        {renderMenuCards()}
      </div>
    </div>
  );
};

export default Main;