import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import "./components/common.css"; // 共通スタイルを読み込み

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
