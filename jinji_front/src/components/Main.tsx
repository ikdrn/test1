import React from 'react';
import { Link } from 'react-router-dom';
import './common.css';

const Main: React.FC = () => {
  return (
    <div className="main-container">
      <h2>メイン画面</h2>
      <div className="grid-container">
        <Link to="/kintai" className="grid-item">
          <h3>勤怠画面</h3>
          <p>出退勤の記録・休暇一覧</p>
        </Link>
        <Link to="/kyuyo" className="grid-item">
          <h3>給与画面</h3>
          <p>給与明細と控除額の計算</p>
        </Link>
        <Link to="/kouka" className="grid-item">
          <h3>人事考課画面</h3>
          <p>評価入力・過去評価の確認</p>
        </Link>
      </div>
    </div>
  );
};

export default Main;